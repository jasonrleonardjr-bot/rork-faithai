import createContextHook from "@nkzw/create-context-hook";
import { useCallback, useEffect, useMemo, useState } from "react";

import { loadJSON, saveJSON } from "@/lib/storage";
import type { Prayer } from "@/lib/types";

const STORE_KEY = "emmaus.prayers";

/** On-device prayer journal. */
export const [PrayerProvider, usePrayers] = createContextHook(() => {
  const [prayers, setPrayers] = useState<Prayer[]>(() => loadJSON<Prayer[]>(STORE_KEY, []));

  useEffect(() => {
    saveJSON(STORE_KEY, prayers);
  }, [prayers]);

  const active = useMemo<Prayer[]>(
    () => prayers.filter((p) => p.answeredAt === null).sort((a, b) => b.createdAt - a.createdAt),
    [prayers],
  );
  const answered = useMemo<Prayer[]>(
    () => prayers.filter((p) => p.answeredAt !== null).sort((a, b) => (b.answeredAt ?? 0) - (a.answeredAt ?? 0)),
    [prayers],
  );

  const prayer = useCallback((id: string) => prayers.find((p) => p.id === id) ?? null, [prayers]);

  const save = useCallback((next: Prayer) => {
    setPrayers((prev) => (prev.some((p) => p.id === next.id) ? prev.map((p) => (p.id === next.id ? next : p)) : [...prev, next]));
  }, []);

  const markAnswered = useCallback((id: string, testimony: string) => {
    setPrayers((prev) => prev.map((p) => (p.id === id ? { ...p, answeredAt: Date.now(), testimony: testimony.trim() } : p)));
  }, []);

  const reopen = useCallback((id: string) => {
    setPrayers((prev) => prev.map((p) => (p.id === id ? { ...p, answeredAt: null } : p)));
  }, []);

  const remove = useCallback((id: string) => {
    setPrayers((prev) => prev.filter((p) => p.id !== id));
  }, []);

  return { prayers, active, answered, prayer, save, markAnswered, reopen, remove };
});
