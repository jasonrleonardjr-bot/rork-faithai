import createContextHook from "@nkzw/create-context-hook";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { backendSocketURL } from "@/lib/backend";
import { loadString, saveString } from "@/lib/storage";
import { uuid, type MeetupMember, type MeetupSpot } from "@/lib/types";

export type MeetupConnection = "idle" | "connecting" | "connected" | "failed";
export type LocationPermission = "unknown" | "prompt" | "granted" | "denied" | "unsupported";

interface Coords {
  lat: number;
  lng: number;
  accuracy: number;
}

function notify(title: string, body: string): void {
  toast(title, { description: body });
  try {
    if ("Notification" in window && Notification.permission === "granted" && document.visibilityState !== "visible") {
      new Notification(title, { body, icon: "/icon.png" });
    }
  } catch {
    // Notification constructor unsupported (e.g. some mobile browsers)
  }
}

/**
 * Realtime meetup client. Connects to the Gather hub over WebSocket, pings
 * location, applies spot state, and notifies on the key transitions: a spot
 * going live, and two or more people selecting one.
 */
export const [MeetupProvider, useMeetup] = createContextHook(() => {
  const [myId] = useState<string>(() => {
    const saved = loadString("emmaus.meetup.userId") || uuid();
    saveString("emmaus.meetup.userId", saved);
    return saved;
  });
  const [myName] = useState<string>(() => {
    const saved = loadString("emmaus.meetup.displayName") || `Pilgrim ${Math.floor(10 + Math.random() * 90)}`;
    saveString("emmaus.meetup.displayName", saved);
    return saved;
  });

  const [connection, setConnection] = useState<MeetupConnection>("idle");
  const [spots, setSpots] = useState<MeetupSpot[]>([]);
  const [members, setMembers] = useState<MeetupMember[]>([]);
  const [location, setLocation] = useState<Coords | null>(null);
  const [permission, setPermission] = useState<LocationPermission>("unknown");
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(
    () => typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted",
  );

  const running = useRef<boolean>(false);
  const socketRef = useRef<WebSocket | null>(null);
  const watchRef = useRef<number | null>(null);
  const locationRef = useRef<Coords | null>(null);
  const previousSpots = useRef<Map<string, MeetupSpot>>(new Map());
  const reconnectAttempt = useRef<number>(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  locationRef.current = location;

  // Reflect the browser's current geolocation permission without prompting.
  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setPermission("unsupported");
      return;
    }
    let status: PermissionStatus | null = null;
    const update = () => {
      if (status) setPermission(status.state === "granted" ? "granted" : status.state === "denied" ? "denied" : "prompt");
    };
    navigator.permissions
      ?.query({ name: "geolocation" as PermissionName })
      .then((result) => {
        status = result;
        update();
        result.addEventListener("change", update);
      })
      .catch(() => setPermission("prompt"));
    return () => status?.removeEventListener("change", update);
  }, []);

  const sendLocation = useCallback((coords: Coords | null) => {
    const socket = socketRef.current;
    if (!coords || !socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({ type: "location", lat: coords.lat, lng: coords.lng }));
  }, []);

  const startWatching = useCallback(() => {
    if (!("geolocation" in navigator) || watchRef.current !== null) return;
    watchRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const coords: Coords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        };
        setPermission("granted");
        const hadNone = locationRef.current === null;
        setLocation(coords);
        locationRef.current = coords;
        if (hadNone) sendLocation(coords);
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          setPermission("denied");
          if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
          watchRef.current = null;
        }
      },
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 20_000 },
    );
  }, [sendLocation]);

  const apply = useCallback(
    (nextSpots: MeetupSpot[], nextMembers: MeetupMember[]) => {
      const seen = new Map<string, MeetupSpot>();
      for (const spot of nextSpots) {
        const old = previousSpots.current.get(spot.id);
        if (!old && spot.memberIds.includes(myId)) {
          notify("A meetup spot is live", `${spot.name} appeared nearby — see who's around.`);
        }
        if (old && old.selections.length < 2 && spot.selections.length >= 2) {
          notify(`Two or more picked ${spot.name}`, `${spot.selections.length} people selected the same spot. It's on — meet there!`);
        }
        seen.set(spot.id, spot);
      }
      previousSpots.current = seen;
      setSpots(nextSpots);
      setMembers(nextMembers);
    },
    [myId],
  );

  const connect = useCallback(() => {
    if (!running.current) return;
    setConnection("connecting");
    let socket: WebSocket;
    try {
      socket = new WebSocket(backendSocketURL("/gather", { userId: myId, name: myName }));
    } catch {
      setConnection("failed");
      return;
    }
    socketRef.current = socket;

    socket.addEventListener("message", (event: MessageEvent<string>) => {
      try {
        const data = JSON.parse(event.data) as { type?: string; spots?: MeetupSpot[]; members?: MeetupMember[] };
        if (data.type === "welcome") {
          reconnectAttempt.current = 0;
          setConnection("connected");
          sendLocation(locationRef.current);
        } else if (data.type === "state") {
          apply(data.spots ?? [], data.members ?? []);
        }
      } catch {
        // ignore malformed frames
      }
    });
    socket.addEventListener("open", () => {
      reconnectAttempt.current = 0;
      setConnection("connected");
    });
    socket.addEventListener("close", () => {
      if (socketRef.current !== socket || !running.current) return;
      socketRef.current = null;
      setConnection("connecting");
      reconnectAttempt.current += 1;
      const delay = Math.min(15, 2 ** Math.min(reconnectAttempt.current, 4)) * 1000;
      reconnectTimer.current = setTimeout(connect, delay);
    });
  }, [apply, myId, myName, sendLocation]);

  // Heartbeat: re-send location every 5 s so the hub keeps us within its 30 s TTL.
  useEffect(() => {
    const timer = setInterval(() => sendLocation(locationRef.current), 5_000);
    return () => clearInterval(timer);
  }, [sendLocation]);

  useEffect(() => {
    return () => {
      running.current = false;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      socketRef.current?.close();
      if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
    };
  }, []);

  /** Idempotent: requests location, then keeps the socket alive so alerts arrive from any tab. */
  const start = useCallback(() => {
    if (running.current) return;
    running.current = true;
    connect();
    if (permission === "granted") startWatching();
  }, [connect, permission, startWatching]);

  // Resume watching automatically if permission was already granted.
  useEffect(() => {
    if (running.current && permission === "granted") startWatching();
  }, [permission, startWatching]);

  const requestLocation = useCallback(() => {
    startWatching();
  }, [startWatching]);

  const enableNotifications = useCallback(async () => {
    if (!("Notification" in window)) return;
    const result = await Notification.requestPermission();
    setNotificationsEnabled(result === "granted");
  }, []);

  const toggleSelection = useCallback(
    (spot: MeetupSpot) => {
      const socket = socketRef.current;
      if (!socket || socket.readyState !== WebSocket.OPEN) return;
      const isMine = spot.selections.includes(myId);
      // Optimistic update; the next server state overwrites it.
      setSpots((prev) =>
        prev.map((s) =>
          s.id === spot.id
            ? { ...s, selections: isMine ? s.selections.filter((u) => u !== myId) : [...s.selections, myId] }
            : s,
        ),
      );
      socket.send(JSON.stringify({ type: isMine ? "deselect" : "select", spotId: spot.id }));
    },
    [myId],
  );

  return {
    myId,
    myName,
    connection,
    spots,
    members,
    location,
    permission,
    notificationsEnabled,
    start,
    requestLocation,
    enableNotifications,
    toggleSelection,
  };
});
