/** Same-origin path to the project's Cloudflare backend (forwarded by Rork hosting). */
export const BACKEND_PATH = "/~api";

/** WebSocket URL for a backend route, built from the page's own origin. */
export function backendSocketURL(path: string, params: Record<string, string>): string {
  const url = new URL(`${BACKEND_PATH}${path}`, window.location.href);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url.toString();
}
