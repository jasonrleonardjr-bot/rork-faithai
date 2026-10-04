import { Flame } from "lucide-react";
import { memo } from "react";

import { cn } from "@/lib/utils";

/** Deep midnight backdrop with a slowly breathing candle glow. */
export const CandleBackground = memo(function CandleBackground({
  intensity = 1,
  className,
}: {
  intensity?: number;
  className?: string;
}) {
  return (
    <div aria-hidden className={cn("pointer-events-none fixed inset-0 -z-10 overflow-hidden", className)}>
      <div className="absolute inset-0 bg-gradient-to-b from-midnight to-ink" />
      <div
        className="absolute left-1/2 top-[-6%] h-[920px] w-[920px] -translate-x-1/2 origin-top animate-candle-breathe rounded-full transition-opacity duration-700"
        style={{
          opacity: intensity,
          background:
            "radial-gradient(closest-side, rgba(214,122,67,0.30), rgba(227,192,127,0.08) 55%, transparent 100%)",
        }}
      />
      <div
        className="absolute bottom-[-10%] right-[-8%] h-[640px] w-[640px] rounded-full transition-opacity duration-700"
        style={{
          opacity: intensity,
          background: "radial-gradient(closest-side, rgba(227,192,127,0.08), transparent 100%)",
        }}
      />
      <div className="grain absolute inset-0 opacity-[0.035] mix-blend-overlay" />
    </div>
  );
});

/** Glowing candle flame mark. */
export function FlameMark({ size = 44, className }: { size?: number; className?: string }) {
  return (
    <div aria-hidden className={cn("relative inline-flex items-center justify-center", className)} style={{ width: size * 1.6, height: size * 1.6 }}>
      <div
        className="absolute rounded-full bg-ember/35"
        style={{ width: size * 1.6, height: size * 1.6, filter: `blur(${size * 0.45}px)` }}
      />
      <svg width={size} height={size} viewBox="0 0 24 24" className="relative animate-flame drop-shadow-[0_0_10px_rgba(214,122,67,0.5)]">
        <defs>
          <linearGradient id={`flame-${size}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#F2D9A6" />
            <stop offset="50%" stopColor="#E3C07F" />
            <stop offset="100%" stopColor="#D67A43" />
          </linearGradient>
        </defs>
        <path
          fill={`url(#flame-${size})`}
          d="M12 2c.6 3.1-1 5-2.6 6.9C7.9 10.7 6.5 12.4 6.5 15a5.5 5.5 0 0 0 11 0c0-2.2-1-3.9-2-5.3-.3 1.4-1 2.5-2.1 3 .6-3.4-.3-7.6-1.4-10.7Z"
        />
      </svg>
    </div>
  );
}

/** Small circular flame avatar for companion messages. */
export function FlameAvatar() {
  return (
    <div
      aria-hidden
      className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full border border-gold/35 bg-surface-high"
    >
      <Flame className="h-[14px] w-[14px] fill-gold stroke-gold" />
    </div>
  );
}

/** Small-caps style eyebrow label. */
export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("eyebrow text-gold", className)}>{children}</p>;
}
