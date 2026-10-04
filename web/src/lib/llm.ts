/** Client for any OpenAI-compatible server (Ollama, LM Studio, llama.cpp, vLLM, or a custom hybrid). */

export interface LLMRequestConfig {
  baseURL: string;
  apiKey: string;
  model: string;
  temperature: number;
}

export interface WireMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export class LLMError extends Error {}

export const NOT_CONFIGURED = "Connect your model server in Settings to begin.";
export const EMPTY_RESPONSE = "The model returned an empty reply. Try again.";

const LOCAL_HOST = /^(localhost|127\.\d+\.\d+\.\d+|\[::1\])$/i;

/**
 * Normalizes input like `my-server.ts.net` into `https://my-server.ts.net/v1`.
 * `localhost` defaults to http (browsers allow it from secure pages); explicit schemes are respected.
 */
export function normalizeBaseURL(input: string): string | null {
  let value = input.trim();
  if (!value) return null;
  if (!value.includes("://")) {
    const host = value.split(/[/:]/)[0] ?? "";
    value = `${LOCAL_HOST.test(host) ? "http" : "https"}://${value}`;
  }
  value = value.replace(/\/+$/, "");
  try {
    const url = new URL(value);
    if (!url.hostname) return null;
    if (url.pathname === "/" || url.pathname === "") url.pathname = "/v1";
    return url.toString().replace(/\/+$/, "");
  } catch {
    return null;
  }
}

/** Human-friendly message for network and server errors. */
export function friendlyMessage(error: unknown): string {
  if (error instanceof DOMException && error.name === "TimeoutError") {
    return "The model took too long to respond. It may still be loading — try again.";
  }
  if (error instanceof TypeError) {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      return "You're offline. Reconnect and try again.";
    }
    return "Couldn't reach your model server. Check the address, make sure it's running, and that it allows browser requests (CORS).";
  }
  if (error instanceof Error) return error.message;
  return "Something went wrong. Try again.";
}

/** True when a secure page would be blocked from calling this http address. */
export function isMixedContent(baseURL: string | null): boolean {
  if (!baseURL || typeof window === "undefined") return false;
  try {
    const url = new URL(baseURL);
    return window.location.protocol === "https:" && url.protocol === "http:" && !LOCAL_HOST.test(url.hostname);
  } catch {
    return false;
  }
}

function headers(apiKey: string): HeadersInit {
  const result: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) result.Authorization = `Bearer ${apiKey}`;
  return result;
}

async function statusError(response: Response): Promise<LLMError> {
  const body = (await response.text().catch(() => "")).slice(0, 300);
  return new LLMError(body ? `Server error ${response.status}: ${body}` : `The server responded with status ${response.status}.`);
}

/** Lists model IDs from `GET /models`. */
export async function fetchModels(baseURL: string, apiKey: string): Promise<string[]> {
  if (isMixedContent(baseURL)) {
    throw new LLMError("Browsers block http addresses from secure pages. Use https (Tailscale, Cloudflare Tunnel, or ngrok) or localhost.");
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException("timeout", "TimeoutError")), 10_000);
  try {
    const response = await fetch(`${baseURL}/models`, { headers: headers(apiKey), signal: controller.signal });
    if (!response.ok) throw await statusError(response);
    const json = (await response.json()) as { data?: { id: string }[] };
    return (json.data ?? []).map((m) => m.id).sort();
  } finally {
    clearTimeout(timer);
  }
}

interface CompletionChunk {
  choices?: { delta?: { content?: string | null }; message?: { content?: string | null } }[];
}

function textFrom(chunk: CompletionChunk): string {
  const choice = chunk.choices?.[0];
  return choice?.delta?.content ?? choice?.message?.content ?? "";
}

/**
 * Streams assistant text deltas from `POST /chat/completions` over SSE.
 * Falls back to a non-streamed JSON body if the server ignores `stream: true`.
 */
export async function* streamChat(
  config: LLMRequestConfig,
  messages: WireMessage[],
  signal: AbortSignal,
): AsyncGenerator<string> {
  if (isMixedContent(config.baseURL)) {
    throw new LLMError("Browsers block http addresses from secure pages. Use https or localhost for your model server.");
  }
  const response = await fetch(`${config.baseURL}/chat/completions`, {
    method: "POST",
    headers: { ...headers(config.apiKey), Accept: "text/event-stream" },
    body: JSON.stringify({ model: config.model, messages, temperature: config.temperature, stream: true }),
    signal,
  });
  if (!response.ok) throw await statusError(response);

  if (!response.body) {
    const text = textFrom((await response.json()) as CompletionChunk);
    if (text) yield text;
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let rawBody = "";
  let didYield = false;
  let finished = false;

  while (!finished) {
    const { done, value } = await reader.read();
    if (done) {
      buffer += decoder.decode();
    } else {
      buffer += decoder.decode(value, { stream: true });
    }

    let newline = buffer.indexOf("\n");
    while (newline >= 0 || (done && buffer.length > 0)) {
      const line = (newline >= 0 ? buffer.slice(0, newline) : buffer).replace(/\r$/, "");
      buffer = newline >= 0 ? buffer.slice(newline + 1) : "";

      if (line.startsWith("data:")) {
        const payload = line.slice(5).trim();
        if (payload === "[DONE]") {
          finished = true;
          break;
        }
        try {
          const text = textFrom(JSON.parse(payload) as CompletionChunk);
          if (text) {
            didYield = true;
            yield text;
          }
        } catch {
          // partial or non-JSON keepalive line
        }
      } else if (line) {
        rawBody += line;
      }
      newline = buffer.indexOf("\n");
    }
    if (done) break;
  }
  reader.cancel().catch(() => undefined);

  if (!didYield && rawBody) {
    try {
      const text = textFrom(JSON.parse(rawBody) as CompletionChunk);
      if (text) yield text;
    } catch {
      // not a JSON body either
    }
  }
}

/** Removes `<think>…</think>` blocks (including an unclosed trailing one) emitted by reasoning models. */
export function stripReasoning(text: string): string {
  let result = text;
  let start = result.indexOf("<think>");
  while (start >= 0) {
    const end = result.indexOf("</think>", start + 7);
    result = end >= 0 ? result.slice(0, start) + result.slice(end + 8) : result.slice(0, start);
    start = result.indexOf("<think>");
  }
  return result.trim();
}

/** True while the model is inside an unclosed `<think>` block. */
export function isInsideReasoning(text: string): boolean {
  const start = text.lastIndexOf("<think>");
  if (start < 0) return false;
  return text.indexOf("</think>", start + 7) < 0;
}
