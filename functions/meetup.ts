// functions/meetup.ts — realtime meetup presence hub.
//
// One Durable Object instance ("global") tracks connected users, clusters
// users who are physically close together, and materializes "meetup spots"
// that go live for those clusters. Spot lifecycle:
//   live (red)     — a spot exists, nobody has selected it
//   ready (green)  — exactly one member selected it
//   crowned (blue) — two or more members selected it (clients notify)

import { DurableObject } from "cloudflare:workers";

export const CLUSTER_RADIUS_M = 150;
const MEMBER_TTL_MS = 30_000;
const RECENT_SPOT_TTL_MS = 10 * 60_000;
const TICK_MS = 5_000;

type Member = { id: string; name: string; lat: number; lng: number; lastSeen: number };
type Spot = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  memberIds: string[];
  selections: string[];
  createdAt: number;
};
type RecentSpot = { id: string; name: string; memberIds: string[]; selections: string[]; at: number };

const SPOT_NAMES = [
  "The Lantern",
  "The Fig Tree",
  "Wellspring",
  "The Crossroads",
  "Olive Grove",
  "Ember Bench",
  "Quiet Waters",
  "The Hearth",
  "Vine & Branch",
  "The Waystation",
  "Shepherd's Field",
  "The Old Gate",
];

function haversineMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

function stableHash(input: string): number {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) + h + input.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function clampCoord(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(-180, Math.min(180, n));
}

export class MeetupHub extends DurableObject {
  private members = new Map<string, Member>();
  private selections = new Map<string, Set<string>>(); // spotId -> userIds
  private recent: RecentSpot[] = [];
  private createdAt = new Map<string, number>();
  private currentSpots: Spot[] = [];
  private lastBroadcast = "";
  private tickHandle: ReturnType<typeof setTimeout> | null = null;

  constructor(ctx: DurableObjectState, env: unknown) {
    super(ctx, env);
    this.ctx.blockConcurrencyWhile(async () => {
      const members = await this.ctx.storage.get<[string, Member][]>("members");
      if (members) {
        for (const [id, member] of members) this.members.set(id, member);
      }
      const selections = await this.ctx.storage.get<[string, string][]>("selections");
      if (selections) {
        for (const [spotId, userIds] of selections) this.selections.set(spotId, new Set(userIds));
      }
    });
  }

  override async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") {
      return Response.json({ ok: true, hub: "meetup", now: Date.now() });
    }

    const url = new URL(request.url);
    const userId = url.searchParams.get("userId");
    if (!userId) return new Response("userId required", { status: 400 });
    const name = url.searchParams.get("name") ?? "Pilgrim";

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ userId });

    // First location ping fills coordinates; greet immediately with protocol constants.
    server.send(JSON.stringify({ type: "welcome", you: userId, radius: CLUSTER_RADIUS_M, now: Date.now() }));

    this.ensureTick();
    return new Response(null, { status: 101, webSocket: client });
  }

  override webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): void {
    if (typeof message !== "string") return;
    const { userId } = ws.deserializeAttachment() as { userId?: string };
    if (!userId) return;

    let data: Record<string, unknown>;
    try {
      data = JSON.parse(message) as Record<string, unknown>;
    } catch {
      return;
    }

    const type = data.type;
    if (type === "location") {
      const lat = clampCoord(data.lat);
      const lng = clampCoord(data.lng);
      if (lat === null || lng === null) return;
      const existing = this.members.get(userId);
      this.members.set(userId, {
        id: userId,
        name: typeof data.name === "string" && data.name ? (data.name as string) : existing?.name ?? "Pilgrim",
        lat,
        lng,
        lastSeen: Date.now(),
      });
      this.persist();
      this.recomputeAndBroadcast();
      this.ensureTick();
      return;
    }

    if (type === "select" || type === "deselect") {
      const spotId = typeof data.spotId === "string" ? data.spotId : "";
      const spot = this.currentSpots.find((s) => s.id === spotId);
      if (!spot) return;
      let selected = this.selections.get(spotId) ?? new Set<string>();
      if (type === "select") {
        if (!spot.memberIds.includes(userId)) return;
        selected = new Set(selected);
        selected.add(userId);
      } else {
        selected.delete(userId);
      }
      this.selections.set(spotId, selected);
      this.persist();
      this.recomputeAndBroadcast();
      return;
    }

    // Unknown or keepalive messages are ignored.
  }

  override webSocketClose(ws: WebSocket): void {
    const { userId } = ws.deserializeAttachment() as { userId?: string };
    if (userId) this.dropUser(userId);
    if (this.ctx.getWebSockets().length === 0) {
      this.clearTick();
      this.recomputeAndBroadcast();
    }
  }

  override webSocketError(ws: WebSocket): void {
    try {
      ws.close(1011, "error");
    } catch {
      // already closing
    }
  }

  private dropUser(userId: string): void {
    this.members.delete(userId);
    for (const [spotId, selected] of this.selections) {
      if (selected.has(userId)) {
        selected.delete(userId);
        if (selected.size === 0) this.selections.delete(spotId);
      }
    }
    this.persist();
  }

  private persist(): void {
    this.ctx.storage.put("members", [...this.members.entries()], { allowUnconfirmed: true });
    this.ctx.storage.put(
      "selections",
      [...this.selections.entries()].map(([spotId, set]) => [spotId, [...set]] as [string, string[]]),
      { allowUnconfirmed: true },
    );
  }

  private recomputeAndBroadcast(): void {
    const state = this.computeState();
    const json = JSON.stringify(state);
    if (json === this.lastBroadcast) return;
    this.lastBroadcast = json;
    for (const peer of this.ctx.getWebSockets()) {
      try {
        peer.send(json);
      } catch {
        // stale socket; the close handler will clean it up
      }
    }
  }

  private computeState(): { type: "state"; spots: Spot[]; members: Array<Omit<Member, "lastSeen">>; serverTime: number } {
    const now = Date.now();

    // Evict members that stopped pinging (app suspended, network lost).
    for (const [id, member] of this.members) {
      if (now - member.lastSeen > MEMBER_TTL_MS) this.members.delete(id);
    }

    // Greedy single-linkage clustering within CLUSTER_RADIUS_M.
    const clusters: Array<{ ids: string[]; lat: number; lng: number }> = [];
    for (const member of this.members.values()) {
      let home: { ids: string[]; lat: number; lng: number } | null = null;
      for (const cluster of clusters) {
        if (haversineMeters(cluster.lat, cluster.lng, member.lat, member.lng) <= CLUSTER_RADIUS_M) {
          home = cluster;
          break;
        }
      }
      if (home) {
        home.ids.push(member.id);
        home.lat = (home.lat * (home.ids.length - 1) + member.lat) / home.ids.length;
        home.lng = (home.lng * (home.ids.length - 1) + member.lng) / home.ids.length;
      } else {
        clusters.push({ ids: [member.id], lat: member.lat, lng: member.lng });
      }
    }

    // Only clusters of two or more become live spots.
    const spots: Spot[] = [];
    for (const cluster of clusters) {
      if (cluster.ids.length < 2) continue;
      const memberIds = [...cluster.ids].sort();
      const id = `spot-${stableHash(memberIds.join("|")).toString(36)}-${memberIds.length}`;
      const centroid = cluster;

      // Carry name + selections from a recently-seen spot with overlapping members
      // so the spot feels continuous when someone joins or leaves the cluster.
      let inheritedName: string | null = null;
      let inheritedSelections = new Set<string>();
      let inheritedCreatedAt = now;
      let bestOverlap = 0;
      for (const old of this.recent) {
        const overlap = old.memberIds.filter((m) => memberIds.includes(m)).length;
        if (overlap >= Math.max(1, Math.ceil(old.memberIds.length / 2)) && overlap > bestOverlap) {
          bestOverlap = overlap;
          inheritedName = old.name;
          inheritedSelections = new Set(old.selections.filter((u) => memberIds.includes(u)));
          const created = this.createdAt.get(old.id);
          inheritedCreatedAt = created ?? now;
        }
      }

      const name = inheritedName ?? SPOT_NAMES[stableHash(id) % SPOT_NAMES.length];
      const selected = this.selections.get(id) ?? inheritedSelections;
      const spot: Spot = {
        id,
        name,
        lat: centroid.lat,
        lng: centroid.lng,
        memberIds,
        selections: [...selected].filter((u) => memberIds.includes(u)),
        createdAt: inheritedCreatedAt,
      };
      this.createdAt.set(id, spot.createdAt);
      this.selections.set(id, new Set(spot.selections));
      spots.push(spot);
    }

    // Remember this generation of spots for continuity; forget ancient history.
    for (const spot of spots) {
      this.recent = this.recent.filter((old) => old.id !== spot.id);
      this.recent.push({ id: spot.id, name: spot.name, memberIds: spot.memberIds, selections: spot.selections, at: now });
    }
    this.recent = this.recent.filter((old) => now - old.at < RECENT_SPOT_TTL_MS);

    this.currentSpots = spots;
    return {
      type: "state",
      spots,
      members: [...this.members.values()].map(({ lastSeen: _lastSeen, ...rest }) => rest),
      serverTime: now,
    };
  }

  private ensureTick(): void {
    if (this.tickHandle !== null || this.ctx.getWebSockets().length === 0) return;
    this.tickHandle = setTimeout(() => {
      this.tickHandle = null;
      this.recomputeAndBroadcast();
      if (this.ctx.getWebSockets().length > 0) this.ensureTick();
    }, TICK_MS);
  }

  private clearTick(): void {
    if (this.tickHandle !== null) {
      clearTimeout(this.tickHandle);
      this.tickHandle = null;
    }
  }
}
