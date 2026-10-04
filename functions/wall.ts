// functions/wall.ts — the shared prayer wall.
//
// One global Durable Object ("wall") stores every prayer cast by any Emmaus
// user on any platform (iOS or web). Clients post new prayers, toggle "I
// prayed this" reactions, and authors can mark their prayer answered (with a
// testimony) or remove it. Author actions require the secret token issued at
// first launch and stored on-device.

import { DurableObject } from "cloudflare:workers";

const MAX_PRAYERS = 300;
const MAX_TEXT_LENGTH = 480;
const MIN_CAST_INTERVAL_MS = 8_000;

type WallPrayer = {
  id: string;
  userId: string;
  token: string;
  name: string;
  anonymous: boolean;
  text: string;
  createdAt: number;
  prayedBy: string[];
  answeredAt: number | null;
  testimony: string;
};

type Incoming = Record<string, unknown>;

function str(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function bad(message: string, status = 400): Response {
  return Response.json({ ok: false, error: message }, { status });
}

export class PrayerWall extends DurableObject {
  private prayers: WallPrayer[] = [];
  private loaded = false;
  private lastCastAt = new Map<string, number>();

  private async ensure(): Promise<void> {
    if (this.loaded) return;
    this.prayers = (await this.ctx.storage.get<WallPrayer[]>("prayers")) ?? [];
    this.loaded = true;
  }

  private async persist(): Promise<void> {
    await this.ctx.storage.put("prayers", this.prayers);
  }

  private visible(prayer: WallPrayer) {
    const { token: _token, ...rest } = prayer;
    // Anonymous prayers never expose the author's name.
    return prayer.anonymous ? { ...rest, name: "A quiet pilgrim" } : rest;
  }

  override async fetch(request: Request): Promise<Response> {
    await this.ensure();
    const url = new URL(request.url);
    // The worker forwards the full path ("/wall/…") — strip the mount point.
    const route = url.pathname.replace(/\/+$/, "").replace(/^\/wall/i, "");
    let body: Incoming = {};
    if (request.method === "POST") {
      body = (await request.json().catch(() => ({}))) as Incoming;
    }

    if (route === "" || route === "/") {
      const prayers = [...this.prayers].sort((a, b) => b.createdAt - a.createdAt);
      return Response.json({ prayers: prayers.map((p) => this.visible(p)), now: Date.now() });
    }

    if (route === "/cast") {
      const userId = str(body.userId, 80);
      const token = str(body.token, 80);
      const text = str(body.text, MAX_TEXT_LENGTH);
      if (!userId || !token) return bad("userId and token are required.");
      if (!text) return bad("Write something on your heart first.");

      const last = this.lastCastAt.get(userId) ?? 0;
      if (Date.now() - last < MIN_CAST_INTERVAL_MS) {
        return bad("Take a breath — you can cast another prayer in a moment.", 429);
      }

      const name = str(body.name, 40) || "A quiet pilgrim";
      const prayer: WallPrayer = {
        id: `wp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        userId,
        token,
        name,
        anonymous: body.anonymous === true,
        text,
        createdAt: Date.now(),
        prayedBy: [],
        answeredAt: null,
        testimony: "",
      };
      this.prayers.push(prayer);

      // Keep the wall at a humane size: retire the oldest answered prayers
      // first, then the oldest overall.
      while (this.prayers.length > MAX_PRAYERS) {
        const oldestAnswered = [...this.prayers]
          .filter((p) => p.answeredAt !== null)
          .sort((a, b) => a.createdAt - b.createdAt)[0];
        const target = oldestAnswered ?? [...this.prayers].sort((a, b) => a.createdAt - b.createdAt)[0];
        this.prayers = this.prayers.filter((p) => p.id !== target.id);
      }

      this.lastCastAt.set(userId, Date.now());
      await this.persist();
      return Response.json({ ok: true, prayer: this.visible(prayer) });
    }

    const prayerId = str(body.prayerId, 80);
    const userId = str(body.userId, 80);
    if (!prayerId) return bad("prayerId is required.");
    const prayer = this.prayers.find((p) => p.id === prayerId);
    if (!prayer) return bad("That prayer is no longer on the wall.", 404);

    if (route === "/pray") {
      if (!userId) return bad("userId is required.");
      const already = prayer.prayedBy.includes(userId);
      prayer.prayedBy = already ? prayer.prayedBy.filter((id) => id !== userId) : [...prayer.prayedBy, userId];
      await this.persist();
      return Response.json({ ok: true, prayed: !already, prayedBy: prayer.prayedBy });
    }

    // Author-only routes below.
    const token = str(body.token, 80);
    if (!userId || !token) return bad("userId and token are required.");
    if (prayer.userId !== userId || prayer.token !== token) {
      return bad("Only the one who cast this prayer can do that.", 403);
    }

    if (route === "/answer") {
      if (prayer.answeredAt !== null) return bad("This prayer is already marked answered.");
      prayer.answeredAt = Date.now();
      prayer.testimony = str(body.testimony, 480);
      await this.persist();
      return Response.json({ ok: true, prayer: this.visible(prayer) });
    }

    if (route === "/reopen") {
      if (prayer.answeredAt === null) return bad("This prayer is still lifted up.");
      prayer.answeredAt = null;
      prayer.testimony = "";
      await this.persist();
      return Response.json({ ok: true, prayer: this.visible(prayer) });
    }

    if (route === "/delete") {
      this.prayers = this.prayers.filter((p) => p.id !== prayerId);
      await this.persist();
      return Response.json({ ok: true });
    }

    return bad("Unknown wall route.", 404);
  }
}
