export type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: number;
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: number;
}

export type Persona = "shepherd" | "scholar" | "friend";

export type PrayerCategory = "personal" | "family" | "healing" | "guidance" | "thanksgiving" | "world";

export interface Prayer {
  id: string;
  title: string;
  details: string;
  category: PrayerCategory;
  createdAt: number;
  answeredAt: number | null;
  testimony: string;
}

export interface Verse {
  reference: string;
  text: string;
  theme: string;
}

/** A pilgrim currently sharing presence on the Gather map. */
export interface MeetupMember {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

/** A live meetup spot. 0 selections = open (red), 1 = confirmed (green), 2+ = crowned (blue). */
export interface MeetupSpot {
  id: string;
  name: string;
  lat: number;
  lng: number;
  memberIds: string[];
  selections: string[];
  createdAt: number;
}

export type SpotState = "open" | "confirmed" | "crowned";

export function spotState(spot: MeetupSpot): SpotState {
  if (spot.selections.length === 0) return "open";
  if (spot.selections.length === 1) return "confirmed";
  return "crowned";
}

/** Generates a v4 UUID, falling back when `crypto.randomUUID` is unavailable. */
export function uuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}
