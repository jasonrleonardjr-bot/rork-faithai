import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Bell, BellRing, Footprints, LoaderCircle, LocateFixed, MapPinOff } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, Marker, TileLayer, useMap } from "react-leaflet";

import { Eyebrow } from "@/components/emmaus/Candle";
import { spotState, type MeetupSpot, type SpotState } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useMeetup, type MeetupConnection } from "@/state/meetup";

const FALLBACK_CENTER: [number, number] = [31.7683, 35.2137]; // Jerusalem, until we find you

const STATE_COPY: Record<SpotState, { label: string; dot: string; ring: string; tint: string }> = {
  open: { label: "Waiting for someone to pick it", dot: "bg-signal", ring: "border-signal/50", tint: "bg-signal/[0.12]" },
  confirmed: { label: "One pilgrim is heading there", dot: "bg-sage", ring: "border-sage/50", tint: "bg-sage/[0.16]" },
  crowned: { label: "Two or more picked it — it's on!", dot: "bg-river", ring: "border-river/50", tint: "bg-river/[0.22]" },
};

const STATE_TEXT: Record<SpotState, string> = { open: "text-signal", confirmed: "text-sage", crowned: "text-river" };

function haversine(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

function formatDistance(meters: number): string {
  return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`;
}

function escapeHTML(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
}

function spotIcon(spot: MeetupSpot, isMine: boolean): L.DivIcon {
  const state = spotState(spot);
  return L.divIcon({
    className: "emmaus-icon",
    iconSize: [46, 46],
    iconAnchor: [23, 23],
    html: `<div class="spot-badge spot-${state}${isMine ? " is-mine" : ""}"><span class="spot-halo"></span><span class="spot-core">${spot.selections.length}</span><span class="spot-label">${escapeHTML(spot.name)}</span></div>`,
  });
}

const memberIcon = L.divIcon({ className: "emmaus-icon", iconSize: [12, 12], iconAnchor: [6, 6], html: '<span class="member-dot"></span>' });
const selfIcon = L.divIcon({
  className: "emmaus-icon",
  iconSize: [20, 20],
  iconAnchor: [10, 10],
  html: '<span class="self-dot"><span class="self-pulse"></span></span>',
});

/** Centers the map on the user once, then whenever the locate button asks. */
function MapFollower({ target, recenterKey }: { target: [number, number] | null; recenterKey: number }) {
  const map = useMap();
  const didCenter = useRef<boolean>(false);
  useEffect(() => {
    if (!target) return;
    if (!didCenter.current) {
      didCenter.current = true;
      map.setView(target, 17, { animate: false });
    }
  }, [map, target]);
  useEffect(() => {
    if (recenterKey > 0 && target) map.flyTo(target, 17, { duration: 0.8 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recenterKey]);
  return null;
}

export default function Gather() {
  const meetup = useMeetup();
  const [recenter, setRecenter] = useRecenter();

  const me: [number, number] | null = meetup.location ? [meetup.location.lat, meetup.location.lng] : null;
  const others = useMemo(() => meetup.members.filter((m) => m.id !== meetup.myId), [meetup.members, meetup.myId]);

  return (
    <main className="fixed inset-0 lg:left-[248px]">
      <MapContainer
        center={FALLBACK_CENTER}
        zoom={me ? 17 : 3}
        zoomControl={false}
        attributionControl
        className="h-full w-full"
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>'
          subdomains="abcd"
          maxZoom={20}
        />
        <MapFollower target={me} recenterKey={recenter} />
        {others.map((member) => (
          <Marker key={member.id} position={[member.lat, member.lng]} icon={memberIcon} title={member.name} />
        ))}
        {me && <Marker position={me} icon={selfIcon} title="You" zIndexOffset={500} />}
        {meetup.spots.map((spot) => (
          <Marker
            key={spot.id}
            position={[spot.lat, spot.lng]}
            icon={spotIcon(spot, spot.selections.includes(meetup.myId))}
            zIndexOffset={1000}
            eventHandlers={{ click: () => meetup.toggleSelection(spot) }}
          />
        ))}
      </MapContainer>

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(214,122,67,0.14),transparent_55%)]" />

      <div className="pointer-events-none absolute inset-x-0 top-[max(env(safe-area-inset-top),12px)] z-[1000] flex items-start justify-between px-4">
        <ConnectionBadge connection={meetup.connection} count={meetup.members.length} />
        <div className="pointer-events-auto flex flex-col gap-2">
          <button
            type="button"
            onClick={() => (me ? setRecenter() : meetup.requestLocation())}
            aria-label="Center on me"
            className="glass pressable flex h-11 w-11 items-center justify-center rounded-2xl text-gold"
          >
            <LocateFixed className="h-5 w-5" />
          </button>
          {"Notification" in window && (
            <button
              type="button"
              onClick={() => void meetup.enableNotifications()}
              aria-label={meetup.notificationsEnabled ? "Notifications on" : "Enable notifications"}
              className={cn(
                "glass pressable flex h-11 w-11 items-center justify-center rounded-2xl",
                meetup.notificationsEnabled ? "text-sage" : "text-mist",
              )}
            >
              {meetup.notificationsEnabled ? <BellRing className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
            </button>
          )}
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-[calc(var(--tabbar-height)+max(env(safe-area-inset-bottom),10px)+12px)] z-[1000] mx-auto max-w-[560px] px-4 lg:bottom-8">
        <section className="glass space-y-3.5 rounded-[24px] py-4">
          <div className="flex items-center justify-between px-[18px]">
            <Eyebrow>Meetup spots</Eyebrow>
            <Legend />
          </div>
          <PanelContent />
        </section>
      </div>
    </main>
  );
}

function useRecenter(): [number, () => void] {
  const [key, setKey] = useState<number>(0);
  const bump = useCallback(() => setKey((k) => k + 1), []);
  return [key, bump];
}

function Legend() {
  return (
    <div className="flex items-center gap-2.5 text-[10px] font-medium text-faint">
      <span className="flex items-center gap-1">
        <span className="h-2 w-2 rounded-full bg-signal" />0
      </span>
      <span className="flex items-center gap-1">
        <span className="h-2 w-2 rounded-full bg-sage" />1
      </span>
      <span className="flex items-center gap-1">
        <span className="h-2 w-2 rounded-full bg-river" />
        2+
      </span>
    </div>
  );
}

function PanelContent() {
  const meetup = useMeetup();

  if (meetup.permission === "unsupported") {
    return <Notice icon={<MapPinOff className="h-6 w-6 text-gold" />} title="Location unavailable" message="This browser can't share your location." />;
  }

  if (meetup.permission === "denied") {
    return (
      <Notice
        icon={<MapPinOff className="h-6 w-6 text-gold" />}
        title="Location is off"
        message="Allow location for this site in your browser settings to join nearby gatherings."
      />
    );
  }

  if (!meetup.location && meetup.permission !== "granted") {
    return (
      <Notice
        icon={<MapPinOff className="h-6 w-6 text-gold" />}
        title="Location needed"
        message="Emmaus uses your location to find pilgrims close by and light up meetup spots."
        action={
          <button
            type="button"
            onClick={meetup.requestLocation}
            className="pressable mt-1 rounded-full border border-gold/50 bg-gold/15 px-[18px] py-2.5 text-[15px] font-semibold text-gold"
          >
            Share my location
          </button>
        }
      />
    );
  }

  if (!meetup.location) {
    return (
      <div className="flex items-center justify-center gap-3 py-2.5">
        <LoaderCircle className="h-4 w-4 animate-spin text-gold" />
        <span className="font-serif text-[16px] text-mist">Finding you…</span>
      </div>
    );
  }

  if (meetup.spots.length === 0) {
    return (
      <Notice
        icon={<Footprints className="h-6 w-6 text-gold" />}
        title="No gatherings nearby yet"
        message="Spots go live when two or more of you are within 150 meters. Keep this open and get close."
      />
    );
  }

  const here = meetup.location;
  return (
    <div className="no-scrollbar max-h-[280px] space-y-2.5 overflow-y-auto px-3">
      {meetup.spots.map((spot) => (
        <SpotRow
          key={spot.id}
          spot={spot}
          isMine={spot.selections.includes(meetup.myId)}
          distance={haversine(here.lat, here.lng, spot.lat, spot.lng)}
          onSelect={() => meetup.toggleSelection(spot)}
        />
      ))}
    </div>
  );
}

function SpotRow({ spot, isMine, distance, onSelect }: { spot: MeetupSpot; isMine: boolean; distance: number; onSelect: () => void }) {
  const state = spotState(spot);
  const copy = STATE_COPY[state];
  const label = isMine ? "You're set" : state === "open" ? "Meet here" : state === "confirmed" ? "1 ready" : `${spot.selections.length} ready!`;

  return (
    <div className="flex animate-rise items-center gap-3 rounded-2xl bg-surface/60 p-3">
      <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full shadow-[0_0_8px_currentColor]", copy.dot, STATE_TEXT[state])} />
      <div className="min-w-0 flex-1">
        <p className="font-serif text-[16px] font-semibold text-parchment">{spot.name}</p>
        <p className="truncate text-xs text-mist">
          {copy.label} · {formatDistance(distance)} away
        </p>
      </div>
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          "pressable shrink-0 rounded-full border px-3 py-2 text-xs font-semibold",
          copy.ring,
          copy.tint,
          isMine ? STATE_TEXT[state] : "text-parchment",
        )}
      >
        {label}
      </button>
    </div>
  );
}

function Notice({ icon, title, message, action }: { icon: React.ReactNode; title: string; message: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-1 text-center">
      {icon}
      <p className="font-serif text-[17px] font-semibold text-parchment">{title}</p>
      <p className="text-[13px] leading-relaxed text-mist">{message}</p>
      {action}
    </div>
  );
}

function ConnectionBadge({ connection, count }: { connection: MeetupConnection; count: number }) {
  const dot =
    connection === "connected"
      ? "bg-sage shadow-[0_0_8px_rgba(156,195,160,0.8)]"
      : connection === "failed"
        ? "bg-ember"
        : "animate-pulse bg-gold";
  const label = connection === "connected" ? `${count} nearby` : connection === "failed" ? "Offline" : connection === "idle" ? "Ready" : "Connecting…";
  return (
    <div className="glass pointer-events-auto flex items-center gap-1.5 rounded-2xl px-3 py-[7px]">
      <span className={cn("h-[7px] w-[7px] rounded-full", dot)} />
      <span className="text-xs font-medium text-parchment">{label}</span>
    </div>
  );
}
