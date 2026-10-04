import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface EmmausSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Visually hide the title (still read by screen readers). */
  hideTitle?: boolean;
  leading?: ReactNode;
  trailing?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** Bottom sheet on phones, centered card on larger screens — midnight background, gold hairline. */
export function EmmausSheet({ open, onOpenChange, title, hideTitle, leading, trailing, children, className }: EmmausSheetProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px] data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          aria-describedby={undefined}
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col overflow-hidden rounded-t-[28px] border-t border-gold/20 bg-midnight shadow-[0_-30px_80px_-20px_rgba(0,0,0,0.8)] outline-none",
            "data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom duration-300",
            "sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-[min(560px,calc(100vw-48px))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[28px] sm:border",
            "sm:data-[state=closed]:slide-out-to-bottom-4 sm:data-[state=open]:slide-in-from-bottom-4 sm:data-[state=open]:zoom-in-95 sm:data-[state=closed]:zoom-out-95",
            className,
          )}
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-[radial-gradient(ellipse_at_top,rgba(214,122,67,0.16),transparent_70%)]" />
          <div className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-white/15 sm:hidden" />
          <header className="relative flex min-h-[52px] shrink-0 items-center justify-between gap-2 px-4">
            <div className="flex min-w-[72px] justify-start">{leading}</div>
            <Dialog.Title className={cn("truncate text-[15px] font-semibold text-parchment", hideTitle && "sr-only")}>{title}</Dialog.Title>
            <div className="flex min-w-[72px] justify-end">
              {trailing ?? (
                <Dialog.Close className="pressable flex h-9 w-9 items-center justify-center rounded-full bg-surface-high text-mist" aria-label="Close">
                  <X className="h-4 w-4" />
                </Dialog.Close>
              )}
            </div>
          </header>
          <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[max(env(safe-area-inset-bottom),20px)]">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Text-style toolbar button for sheet headers (Cancel / Save / Done). */
export function SheetAction({
  children,
  onClick,
  disabled,
  tone = "gold",
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tone?: "gold" | "mist";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "pressable min-h-[44px] px-1 text-[15px] disabled:opacity-35",
        tone === "gold" ? "font-semibold text-gold" : "text-mist",
      )}
    >
      {children}
    </button>
  );
}
