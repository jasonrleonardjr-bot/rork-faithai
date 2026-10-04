import { Link } from "react-router-dom";

import { cn } from "@/lib/utils";
import { useSettings } from "@/state/settings";

/** Compact indicator of the model server connection. */
export function StatusPill({ className }: { className?: string }) {
  const { connection, isReady, statusLabel } = useSettings();
  const dot =
    connection.kind === "connected"
      ? "bg-sage shadow-[0_0_8px_rgba(156,195,160,0.8)]"
      : connection.kind === "failed"
        ? "bg-ember shadow-[0_0_8px_rgba(214,122,67,0.8)]"
        : connection.kind === "testing" || isReady
          ? "bg-gold shadow-[0_0_8px_rgba(227,192,127,0.8)]"
          : "bg-faint";

  return (
    <Link
      to="/settings"
      className={cn(
        "pressable inline-flex max-w-[220px] items-center gap-1.5 rounded-full border border-hairline bg-surface/80 px-2.5 py-1.5",
        className,
      )}
    >
      <span className={cn("h-[7px] w-[7px] shrink-0 rounded-full", dot, connection.kind === "testing" && "animate-pulse")} />
      <span className="truncate text-xs font-medium text-mist">{statusLabel}</span>
    </Link>
  );
}
