// functions/index.ts — the entrypoint for your project's backend.
//
// Vanilla Cloudflare Worker. /gather upgrades to a WebSocket handled by the
// MeetupHub Durable Object (one global instance): presence, clustering, and
// meetup spot state. See meetup.ts. /wall is the shared prayer wall REST API
// handled by the PrayerWall Durable Object. See wall.ts. /llm is an
// OpenAI-compatible relay that forwards to your own model server (linked via a
// Cloudflare Tunnel). See llm.ts.
//
// Works in two environments:
//   - Rork hosting: Rork dispatches DOs via env.DO + X-Rork-DO-* headers, and
//     already strips the web app's "/~api" prefix before requests arrive here.
//   - Self-hosted (see wrangler.selfhost.jsonc): real Durable Object namespace
//     bindings (MEETUP_HUB, WALL) plus the web app served as static assets —
//     this worker then strips the "/~api" prefix itself.

import type { DurableObjectNamespace, Fetcher } from "@cloudflare/workers-types";

import { handleLLM, type RelayEnv } from "./llm";

export { MeetupHub } from "./meetup";
export { PrayerWall } from "./wall";

type Env = {
  DO: Fetcher; // Rork-managed DO dispatcher
  MEETUP_HUB?: DurableObjectNamespace; // self-hosted bindings (wrangler.selfhost.jsonc)
  WALL?: DurableObjectNamespace;
  LLM_UPSTREAM?: string;
  LLM_API_KEY?: string;
};

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const withCors = (response: Response): Response => {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(CORS)) headers.set(key, value);
  return new Response(response.body, { status: response.status, headers });
};

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    let request = req;
    const url = new URL(request.url);

    // Self-hosted: the web app calls the backend same-origin under "/~api".
    if (url.pathname === "/~api" || url.pathname.startsWith("/~api/")) {
      url.pathname = url.pathname.slice("/~api".length) || "/";
      request = new Request(url.toString(), request);
    }

    if (url.pathname === "/ping") {
      return withCors(Response.json({ ok: true, now: new Date().toISOString() }));
    }

    // MUST use the 2-arg form — a 1-arg clone drops the Upgrade header.
    const toDO = (className: string, id: string) => {
      const wrapped = new Request(request.url, request);
      wrapped.headers.set("X-Rork-DO-Class", className);
      wrapped.headers.set("X-Rork-DO-Id", id);
      return env.DO.fetch(wrapped);
    };

    // Prefer real namespace bindings (self-hosted); fall back to Rork's dispatcher.
    const dispatchDO = (ns: DurableObjectNamespace | undefined, className: string, id: string) =>
      ns ? ns.get(ns.idFromName(id)).fetch(request) : toDO(className, id);

    if (url.pathname === "/gather") {
      return dispatchDO(env.MEETUP_HUB, "MeetupHub", "global");
    }

    if (url.pathname === "/wall" || url.pathname.startsWith("/wall/")) {
      if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
      return withCors(dispatchDO(env.WALL, "PrayerWall", "wall"));
    }

    if (url.pathname === "/llm" || url.pathname.startsWith("/llm/")) {
      return handleLLM(request, env);
    }

    return new Response("not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
