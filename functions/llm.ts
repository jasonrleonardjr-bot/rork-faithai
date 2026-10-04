// functions/llm.ts — OpenAI-compatible relay.
//
// Lets Emmaus (web + iOS) talk to your own model server through this worker
// instead of directly, so you get one stable HTTPS URL, no CORS setup, and no
// mixed-content problems. Your home server is linked to the worker with a
// Cloudflare Tunnel (see README.md).
//
// Configuration (private environment variables on the worker):
//   LLM_UPSTREAM — base URL of an OpenAI-compatible server, e.g.
//                  "https://llm.yourdomain.com" (a "/v1" path is added
//                  automatically if missing).
//   LLM_API_KEY  — optional. Sent as "Authorization: Bearer …" to the upstream.
//                  If unset, the client's own Authorization header is forwarded.
//
// Routes (everything after "/llm" is forwarded to the upstream, "/v1" stripped):
//   GET  /llm/status                — is an upstream linked? reachable? how many models?
//   GET  /llm/v1/models             — upstream GET  {upstream}/models
//   POST /llm/v1/chat/completions   — upstream POST {upstream}/chat/completions
//                                     (streaming SSE bodies are passed through untouched)

export interface RelayEnv {
  LLM_UPSTREAM?: string;
  LLM_API_KEY?: string;
}

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

/** Normalizes "llm.domain.com" or "https://llm.domain.com" into an upstream whose path ends in "/v1". */
function normalizeUpstream(raw: string): string | null {
  let value = raw.trim();
  if (!value) return null;
  if (!/^https?:\/\//i.test(value)) value = `https://${value}`;
  value = value.replace(/\/+$/, "");
  try {
    const url = new URL(value);
    if (!url.hostname) return null;
    if (url.pathname === "" || url.pathname === "/") url.pathname = "/v1";
    return url.toString().replace(/\/+$/, "");
  } catch {
    return null;
  }
}

/** Prefer the worker's own key; fall back to forwarding whatever the client sent. */
function authHeaders(env: RelayEnv, request: Request): Headers {
  const headers = new Headers();
  if (env.LLM_API_KEY) {
    headers.set("Authorization", `Bearer ${env.LLM_API_KEY}`);
  } else {
    const client = request.headers.get("Authorization");
    if (client) headers.set("Authorization", client);
  }
  return headers;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

export async function handleLLM(request: Request, env: RelayEnv): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const url = new URL(request.url);
  const sub = url.pathname.slice("/llm".length) || "/";

  const upstream = env.LLM_UPSTREAM?.trim() ? normalizeUpstream(env.LLM_UPSTREAM) : null;

  // --- status -------------------------------------------------------------
  if (request.method === "GET" && (sub === "/" || sub === "/status")) {
    if (!upstream) {
      return json({
        ok: true,
        configured: false,
        message: "No model server linked yet. Set the LLM_UPSTREAM environment variable on the worker (see README.md).",
      });
    }
    const host = new URL(upstream).host;
    try {
      const response = await fetch(`${upstream}/models`, {
        headers: authHeaders(env, request),
        signal: AbortSignal.timeout(8_000),
      });
      if (!response.ok) {
        return json({ ok: true, configured: true, upstream: host, reachable: false, status: response.status });
      }
      const data = (await response.json()) as { data?: { id: string }[] };
      return json({
        ok: true,
        configured: true,
        upstream: host,
        reachable: true,
        models: (data.data ?? []).length,
      });
    } catch {
      return json({
        ok: true,
        configured: true,
        upstream: host,
        reachable: false,
        error: "Model server did not respond within 8s. Is it running and is the tunnel up?",
      });
    }
  }

  // --- proxy --------------------------------------------------------------
  if (!upstream) {
    return json(
      {
        ok: false,
        error: "No model server is linked to this relay yet. Set LLM_UPSTREAM on the worker (see README.md), or point Emmaus directly at your server in Settings.",
      },
      503,
    );
  }

  if (request.method !== "GET" && request.method !== "POST") {
    return json({ ok: false, error: "Only GET and POST are supported." }, 405);
  }

  const remainder = sub.replace(/^\/v1(?=\/)/, "");
  const target = `${upstream}${remainder}${url.search}`;

  const headers = authHeaders(env, request);
  headers.set("Content-Type", request.headers.get("Content-Type") ?? "application/json");
  if (request.method === "POST") headers.set("Accept", "text/event-stream");

  try {
    const response = await fetch(target, {
      method: request.method,
      headers,
      body: request.method === "POST" ? request.body : undefined,
    });
    const responseHeaders = new Headers(response.headers);
    for (const [key, value] of Object.entries(CORS_HEADERS)) responseHeaders.set(key, value);
    return new Response(response.body, { status: response.status, headers: responseHeaders });
  } catch {
    return json(
      { ok: false, error: "The relay couldn't reach your model server. Check that it's running and the Cloudflare Tunnel is up." },
      502,
    );
  }
}
