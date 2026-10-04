# Emmaus — a Christian AI companion

An AI companion for prayer, Scripture, and quiet conversation. You bring your own model
server (any OpenAI-compatible endpoint); Emmaus brings the candlelight.

| App | Path | What it is |
| --- | --- | --- |
| iPhone app | `ios-emmaus/` | Native SwiftUI app — Today, Companion (chat), Gather (live meetups on a map), Prayers (shared wall + journal), Settings |
| Web app | `web/` | Full clone of the iOS experience for the browser |
| Backend | `functions/` | Cloudflare Worker + Durable Objects: prayer wall, Gather presence hub, and the LLM relay |

The web app is the same product with the same design language ("candlelight at
midnight"), so prayers cast on iPhone appear on the web wall and vice versa.

---

## Connecting your own model server

Emmaus talks to **any OpenAI-compatible server**: Ollama, LM Studio, llama.cpp, vLLM,
or a custom hybrid. You have two ways to link it.

### Option A — direct (simplest)

1. Expose your server over HTTPS. From a home machine the easy way is a Cloudflare Tunnel:

   ```sh
   # one-off test URL (changes on restart)
   cloudflared tunnel --url http://localhost:11434

   # or a permanent URL on your own domain:
   cloudflared tunnel create emmaus-llm
   cloudflared tunnel route dns emmaus-llm llm.yourdomain.com
   cloudflared tunnel run emmaus-llm
   ```

2. Open **Settings → Model server** in Emmaus and paste the address
   (e.g. `https://llm.yourdomain.com`). The `/v1` path is added automatically.
   Hit **Test connection** to verify.

Notes:
- The browser (web app) requires HTTPS and CORS. LM Studio has a CORS toggle; for
  Ollama set `OLLAMA_ORIGINS=*` before starting it. The iPhone app also requires
  HTTPS (Apple's ATS).
- The Cloudflare Tunnel gives you HTTPS for free, which is why it's recommended.

### Option B — through the built-in relay (recommended)

The backend worker includes an OpenAI-compatible relay at `/llm` that forwards to your
server. Both apps then point at one stable URL and your server never needs CORS, and
the API key can live on the worker instead of in every client.

Once your tunnel is up, set two private environment variables on the worker:

| Variable | Example | Purpose |
| --- | --- | --- |
| `LLM_UPSTREAM` | `https://llm.yourdomain.com` | Your server's base URL (`/v1` is added if missing) |
| `LLM_API_KEY` | `sk-…` | Optional. Sent upstream as a Bearer token. If unset, the client's own `Authorization` header is forwarded |

Then in Emmaus Settings, set the **Server address** to:

- Web app: `https://<your-web-domain>/~api/llm/v1`
- iPhone app: `https://faithai-backend.rork.app/llm/v1`

Relay endpoints:

```
GET  /llm/status              → { configured, reachable, models }
GET  /llm/v1/models           → proxied to <upstream>/models
POST /llm/v1/chat/completions → proxied to <upstream>/chat/completions (SSE streaming passes through)
```

### Securing a self-hosted server

A tunnel makes your server reachable from the public internet, so put a key in front
of it (LM Studio can require an API key natively; for Ollama run a small auth proxy).
Set that key as `LLM_API_KEY` on the worker and leave it out of the clients.

---

## Backend reference

All backend routes live on one Cloudflare Worker (`functions/index.ts`):

- `GET /ping` — health check
- `/gather` — WebSocket upgrade handled by the `MeetupHub` Durable Object
  (presence, clustering, meetup spots; see `functions/meetup.ts`)
- `/wall`, `/wall/*` — shared prayer wall REST API handled by the `PrayerWall`
  Durable Object (see `functions/wall.ts`). `POST /wall/cast|/pray|/answer|/reopen|/delete`,
  author actions are authorized by a client-held token
- `/llm/*` — OpenAI-compatible relay (see `functions/llm.ts`)

---

## Development

```sh
# web (Vite + React + Tailwind)
cd web && bun install && bun run build

# backend — deploy/bundle check
# (run from the project root with the Rork tooling: runChecks appPath "functions")

# iOS — open ios-emmaus/Emmaus.xcodeproj in Xcode (SwiftUI, iOS 18+)
```

---

## Hosting the web app on Cloudflare

Yes — the web app is a static Vite build, so Cloudflare Pages (or Workers with static
assets) hosts it happily. The Rork-hosted copy keeps working as-is; this is for
putting it on **your own** Cloudflare account:

1. Push the repo to GitHub (see below).
2. Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git**,
   pick the repo, and set:
   - Project root: `web`
   - Build command: `bun run build`
   - Build output directory: `dist`
   - Environment variable: `VITE_BACKEND_BASE_URL = https://faithai-backend.rork.app`
     (this tells the app to call the backend worker directly instead of the
     same-origin `/~api` proxy — the worker already sends permissive CORS headers)
3. Deploy. Your prayer wall, Gather meetups, and companion chat all work from the
   Pages domain; only the LLM base URL in Settings is per-user config.

> Fully self-owned option: the worker in `functions/` can also be deployed to your
> own Cloudflare account with `wrangler deploy` (add the Durable Object migrations
> and set `LLM_UPSTREAM`/`LLM_API_KEY`), then point `VITE_BACKEND_BASE_URL` at your
> own worker URL. Nothing in the code is Rork-specific.

---

## Publishing to GitHub

The code is version-controlled automatically; to mirror it to GitHub:

1. Create an empty repository on <https://github.com/new> (no README/gitignore —
   this repo already has both).
2. Add it as a second remote and push:

   ```sh
   git remote add github https://github.com/<you>/emmaus.git
   git push github main
   ```

3. (Optional) make it private — prayer content is personal. The wall stores what
   people post, so treat the repo and the deployment as private by default.
