import { Flame, HandHeart, Map as MapIcon, SlidersHorizontal, Sunrise, type LucideIcon } from "lucide-react";
import { useEffect } from "react";
import { NavLink, Outlet } from "react-router-dom";

import { cn } from "@/lib/utils";
import { useMeetup } from "@/state/meetup";

import { FlameMark } from "./Candle";

const TABS: { to: string; label: string; icon: LucideIcon }[] = [
  { to: "/", label: "Today", icon: Sunrise },
  { to: "/companion", label: "Companion", icon: Flame },
  { to: "/gather", label: "Gather", icon: MapIcon },
  { to: "/prayers", label: "Prayers", icon: HandHeart },
  { to: "/settings", label: "Settings", icon: SlidersHorizontal },
];

/** Root layout: floating glass tab bar on phones, candle-lit side rail on desktop. */
export function AppShell() {
  const { start } = useMeetup();

  // Keep the Gather socket alive from launch so meetup alerts arrive on any tab (mirrors iOS).
  useEffect(() => {
    start();
  }, [start]);

  return (
    <div className="min-h-dvh lg:pl-[248px]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[248px] flex-col border-r border-hairline bg-ink/70 px-4 py-6 backdrop-blur-xl lg:flex">
        <div className="mb-8 flex items-center gap-1 px-2">
          <FlameMark size={22} />
          <div>
            <p className="font-serif text-2xl font-semibold leading-none text-parchment">Emmaus</p>
            <p className="mt-1 text-[11px] text-faint">Walk the road together</p>
          </div>
        </div>
        <nav className="flex flex-col gap-1">
          {TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.to === "/"}
              className={({ isActive }) =>
                cn(
                  "pressable group flex items-center gap-3 rounded-2xl px-3 py-3 text-[15px] font-medium transition-colors",
                  isActive ? "bg-gold/10 text-gold" : "text-mist hover:bg-white/[0.03] hover:text-parchment",
                )
              }
            >
              {({ isActive }) => (
                <>
                  <tab.icon className={cn("h-5 w-5", isActive && "fill-gold/25")} strokeWidth={isActive ? 2.2 : 1.8} />
                  {tab.label}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <p className="mt-auto px-3 font-serif text-sm italic leading-relaxed text-faint">
          “Did not our heart burn within us, while he talked with us by the way?”
          <span className="mt-1 block not-italic text-gold/60">Luke 24:32</span>
        </p>
      </aside>

      <Outlet />

      <nav
        className="glass fixed inset-x-3 bottom-[max(env(safe-area-inset-bottom),10px)] z-40 mx-auto flex h-[var(--tabbar-height)] max-w-[520px] items-center justify-around rounded-[28px] px-1 lg:hidden"
        aria-label="Primary"
      >
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.to === "/"}
            className={({ isActive }) =>
              cn(
                "pressable relative flex h-full min-w-[60px] flex-1 flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors",
                isActive ? "text-gold" : "text-faint",
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && <span className="absolute inset-x-2 inset-y-1.5 -z-10 rounded-[20px] bg-gold/10" />}
                <tab.icon className={cn("h-[22px] w-[22px]", isActive && "fill-gold/25")} strokeWidth={isActive ? 2.2 : 1.8} />
                {tab.label}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
