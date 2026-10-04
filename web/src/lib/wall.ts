import { BACKEND_PATH } from "@/lib/backend";
import { loadJSON, saveJSON } from "@/lib/storage";
import { uuid } from "@/lib/types";

/** A prayer cast on the shared wall, visible to every Emmaus user. */
export interface WallPrayer {
  id: string;
  userId: string;
  name: string;
  anonymous: boolean;
  text: string;
  createdAt: number;
  prayedBy: string[];
  answeredAt: number | null;
  testimony: string;
}

/** Secret author identity — the token proves "this is my prayer" for author actions. */
export interface WallIdentity {
  userId: string;
  token: string;
}

const IDENTITY_KEY = "emmaus.wall.identity";

/** Lazily mints and persists this browser's wall identity. */
export function wallIdentity(): WallIdentity {
  const existing = loadJSON<WallIdentity | null>(IDENTITY_KEY, null);
  if (existing?.userId && existing.token) return existing;
  const fresh: WallIdentity = { userId: uuid(), token: uuid() };
  saveJSON(IDENTITY_KEY, fresh);
  return fresh;
}

async function wallCall<T>(path: string, body?: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${BACKEND_PATH}/wall${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    let message = `The wall is unreachable (${response.status}).`;
    try {
      const data = (await response.json()) as { error?: string };
      if (data.error) message = data.error;
    } catch {
      // keep the default message
    }
    throw new Error(message);
  }
  return (await response.json()) as T;
}

export interface CastInput {
  text: string;
  name: string;
  anonymous: boolean;
}

/** REST client for the shared prayer wall. */
export const wallApi = {
  list: async (): Promise<WallPrayer[]> => {
    const data = await wallCall<{ prayers: WallPrayer[]; now: number }>("");
    return data.prayers;
  },
  cast: async (identity: WallIdentity, input: CastInput): Promise<void> => {
    await wallCall<{ ok: boolean }>("/cast", { ...identity, ...input });
  },
  pray: async (identity: WallIdentity, prayerId: string): Promise<void> => {
    await wallCall<{ ok: boolean }>("/pray", { ...identity, prayerId });
  },
  answer: async (identity: WallIdentity, prayerId: string, testimony: string): Promise<void> => {
    await wallCall<{ ok: boolean }>("/answer", { ...identity, prayerId, testimony });
  },
  reopen: async (identity: WallIdentity, prayerId: string): Promise<void> => {
    await wallCall<{ ok: boolean }>("/reopen", { ...identity, prayerId });
  },
  remove: async (identity: WallIdentity, prayerId: string): Promise<void> => {
    await wallCall<{ ok: boolean }>("/delete", { ...identity, prayerId });
  },
};
