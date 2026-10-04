/**
 * Base of the project's Cloudflare backend.
 *
 * - Default (Rork hosting): same-origin "/~api", which the platform proxies to the worker.
 * - Self-hosted (e.g. Cloudflare Pages): set VITE_BACKEND_BASE_URL at build time to the
 *   worker URL, e.g. `https://faithai-backend.rork.app` — routes are then called directly.
 */
const configuredBase = (import.meta.env.VITE_BACKEND_BASE_URL as string | undefined)?.replace(/\/+$/, "");

export const BACKEND_PATH = configuredBase || "/~api";

/** WebSocket URL for a backend route, built from the page's own origin. */
export function backendSocketURL(path: string, params: Record<string, string>): string {
  const url = new URL(`${BACKEND_PATH}${path}`, window.location.href);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url.toString();
}
