import { ChevronRight, Server, Share, Shuffle, Sparkles } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { CandleBackground, Eyebrow, FlameMark } from "@/components/emmaus/Candle";
import { useStartConversation } from "@/hooks/use-chat-context";
import { quickActions } from "@/lib/options";
import type { Verse } from "@/lib/types";
import { randomVerse, verseOfTheDay, verseShareText } from "@/lib/verses";
import { usePrayers } from "@/state/prayers";
import { useSettings } from "@/state/settings";

function greetingFor(name: string): string {
  const hour = new Date().getHours();
  const base =
    hour >= 5 && hour < 12
      ? "Good morning"
      : hour >= 12 && hour < 17
        ? "Good afternoon"
        : hour >= 17 && hour < 22
          ? "Good evening"
          : "Peace be with you";
  const trimmed = name.trim();
  return trimmed ? `${base}, ${trimmed}` : base;
}

export default function Today() {
  const { displayName, isReady } = useSettings();
  const { prayers, active, answered } = usePrayers();
  const start = useStartConversation();
  const [verse, setVerse] = useState<Verse>(() => verseOfTheDay());

  const actions = useMemo(() => quickActions(verse), [verse]);
  const dateLabel = useMemo<string>(
    () => new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }),
    [],
  );

  const share = useCallback(async () => {
    const text = verseShareText(verse);
    try {
      if (navigator.share) {
        await navigator.share({ text });
        return;
      }
      await navigator.clipboard.writeText(text);
      toast("Verse copied", { description: verse.reference });
    } catch {
      // share sheet dismissed
    }
  }, [verse]);

  return (
    <main className="relative">
      <CandleBackground />
      <div className="pb-tabbar mx-auto flex max-w-[720px] flex-col gap-6 px-5 pt-[max(env(safe-area-inset-top),20px)] lg:pt-12">
        <header className="flex animate-rise items-start justify-between gap-3 pt-3">
          <div className="space-y-1.5">
            <Eyebrow className="text-faint">{dateLabel}</Eyebrow>
            <h1 className="font-serif text-[34px] font-semibold leading-[1.1] text-parchment sm:text-[42px]">
              {greetingFor(displayName)}
            </h1>
          </div>
          <FlameMark size={26} className="mt-1 shrink-0" />
        </header>

        {!isReady && (
          <Link
            to="/settings"
            className="emmaus-card pressable flex animate-rise items-center gap-3.5 !rounded-[20px] p-3.5 [animation-delay:80ms]"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gold/10 text-gold">
              <Server className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[17px] font-semibold text-parchment">Connect your model</span>
              <span className="block text-[15px] text-mist">Point Emmaus at your local AI server to begin.</span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-faint" />
          </Link>
        )}

        <VerseCard
          verse={verse}
          onReflect={() =>
            start(
              `Help me reflect on ${verse.reference}: “${verse.text}” What was happening when this was written, and what might it mean for my life today?`,
            )
          }
          onShuffle={() => setVerse((current) => randomVerse(current))}
          onShare={share}
        />

        <section className="animate-rise space-y-3 [animation-delay:240ms]">
          <Eyebrow>Walk with me</Eyebrow>
          <div className="grid grid-cols-2 gap-3">
            {actions.map((action) => (
              <button
                key={action.id}
                type="button"
                onClick={() => start(action.prompt)}
                className="emmaus-card pressable flex min-h-[138px] flex-col items-start gap-3.5 !rounded-[22px] p-4 text-left"
              >
                <span className="flex h-[42px] w-[42px] items-center justify-center rounded-xl bg-gold/10">
                  <action.icon className="h-5 w-5 text-gold" />
                </span>
                <span className="space-y-0.5">
                  <span className="block font-serif text-[17px] font-semibold leading-tight text-parchment">{action.title}</span>
                  <span className="line-clamp-2 block text-xs text-mist">{action.subtitle}</span>
                </span>
              </button>
            ))}
          </div>
        </section>

        <Link to="/prayers" className="emmaus-card pressable flex animate-rise items-center gap-4 p-[18px] [animation-delay:320ms]">
          <div className="min-w-0 flex-1 space-y-1.5">
            <Eyebrow>Prayer journal</Eyebrow>
            {prayers.length === 0 ? (
              <p className="font-serif text-[17px] text-mist">
                Begin a record of what you bring before God — and watch for His answers.
              </p>
            ) : (
              <>
                <p className="font-serif text-xl font-medium text-parchment">
                  {active.length} lifted up · {answered.length} answered
                </p>
                {active[0] && <p className="truncate text-[15px] text-mist">{active[0].title}</p>}
              </>
            )}
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-faint" />
        </Link>
      </div>
    </main>
  );
}

function VerseCard({
  verse,
  onReflect,
  onShuffle,
  onShare,
}: {
  verse: Verse;
  onReflect: () => void;
  onShuffle: () => void;
  onShare: () => void;
}) {
  return (
    <article className="relative animate-rise overflow-hidden rounded-[28px] bg-gradient-to-b from-surface-high/95 to-surface/85 p-[22px] shadow-[0_24px_60px_-20px_rgba(214,122,67,0.25)] [animation-delay:160ms]">
      <div className="emmaus-card pointer-events-none absolute inset-0 !rounded-[28px] !bg-transparent" />
      <span
        aria-hidden
        className="pointer-events-none absolute -top-10 right-2 select-none font-serif text-[180px] font-bold leading-none text-gold/[0.06]"
      >
        ”
      </span>
      <div className="relative space-y-[18px]">
        <div className="flex items-center justify-between">
          <Eyebrow>Verse of the day · {verse.theme}</Eyebrow>
          <button
            type="button"
            onClick={onShuffle}
            aria-label="Another verse"
            className="pressable -m-3 flex h-11 w-11 items-center justify-center text-mist hover:text-parchment"
          >
            <Shuffle className="h-4 w-4" />
          </button>
        </div>

        <p key={verse.reference} className="animate-rise font-serif text-[23px] italic leading-[1.45] text-parchment sm:text-[26px]">
          “{verse.text}”
        </p>
        <p className="text-gold-gradient font-serif text-[17px] font-semibold">{verse.reference}</p>

        <div className="h-px bg-hairline" />

        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={onReflect}
            className="bg-gold-gradient pressable inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-[15px] font-semibold text-ink"
          >
            <Sparkles className="h-4 w-4" /> Reflect
          </button>
          <button
            type="button"
            onClick={onShare}
            className="pressable inline-flex h-10 items-center gap-1.5 rounded-full border border-hairline bg-surface-high px-4 text-[15px] font-semibold text-parchment"
          >
            <Share className="h-4 w-4" /> Share
          </button>
        </div>
      </div>
    </article>
  );
}
