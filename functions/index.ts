// functions/index.ts — the entrypoint for your project's backend.
//
// Vanilla Cloudflare Worker. /gather upgrades to a WebSocket handled by the
// MeetupHub Durable Object (one global instance): presence, clustering, and
// meetup spot state. See meetup.ts. /wall is the shared prayer wall REST API
// handled by the PrayerWall Durable Object. See wall.ts. /llm is an
// OpenAI-compatible relay that forwards to your own model server (linked via a
// Cloudflare Tunnel). See llm.ts.

import type { Fetcher } from "@cloudflare/workers-types";

import { handleLLM, type RelayEnv } from "./llm";

export { MeetupHub } from "./meetup";
export { PrayerWall } from "./wall";

type Env = {
  DO: Fetcher;
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
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

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

    if (url.pathname === "/gather") {
      return toDO("MeetupHub", "global");
    }

    if (url.pathname === "/wall" || url.pathname.startsWith("/wall/")) {
      if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
      return withCors(toDO("PrayerWall", "wall"));
    }

    if (url.pathname === "/llm" || url.pathname.startsWith("/llm/")) {
      return handleLLM(request, env);
    }

    return new Response("not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
