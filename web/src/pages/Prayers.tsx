import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, Ellipsis, Eye, EyeOff, Flame, HandHeart, Pencil, Plus, Sparkles, Sun, Trash2, Undo2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { CandleBackground, Eyebrow } from "@/components/emmaus/Candle";
import { EmmausSheet, SheetAction } from "@/components/emmaus/Sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useStartConversation } from "@/hooks/use-chat-context";
import { categoryInfo, PRAYER_CATEGORIES } from "@/lib/options";
import { cn } from "@/lib/utils";
import { wallApi, wallIdentity, type WallPrayer } from "@/lib/wall";
import { usePrayers } from "@/state/prayers";
import { useSettings } from "@/state/settings";
import { uuid, type Prayer, type PrayerCategory } from "@/lib/types";

type View = "everyone" | "active" | "answered";

const WALL_KEY = ["wall"] as const;
const DAY = 86_400_000;

function longDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

function shortDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function relativeDay(ms: number): string {
  const days = Math.round((ms - Date.now()) / DAY);
  return new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }).format(days, "day");
}

function timeAgo(ms: number): string {
  const minutes = Math.floor((Date.now() - ms) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function Prayers() {
  const store = usePrayers();
  const [view, setView] = useState<View>("everyone");
  const [composing, setComposing] = useState<boolean>(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // The wall query lives here (for header stats) and in WallFeed (shared cache).
  const { data: wallPrayers = [] } = useQuery({ queryKey: WALL_KEY, queryFn: wallApi.list });
  const wallLifted = wallPrayers.filter((p) => p.answeredAt === null).length;

  const items = view === "active" ? store.active : store.answered;

  return (
    <main className="relative">
      <CandleBackground intensity={0.7} />
      <div className="pb-tabbar mx-auto flex max-w-[720px] flex-col gap-5 px-5 pt-[max(env(safe-area-inset-top),20px)] lg:pt-12">
        <header className="animate-rise space-y-1.5 pt-3">
          <Eyebrow className="text-faint">{view === "everyone" ? "Prayer wall" : "Prayer journal"}</Eyebrow>
          <h1 className="font-serif text-[34px] font-semibold leading-tight text-parchment sm:text-[42px]">Cast your cares</h1>
          <div className="flex gap-5 pt-1.5">
            {view === "everyone" ? (
              <>
                <Stat value={wallLifted} label="lifted up" />
                <Stat value={wallPrayers.length - wallLifted} label="answered" />
              </>
            ) : (
              <>
                <Stat value={store.active.length} label="lifted up" />
                <Stat value={store.answered.length} label="answered" />
              </>
            )}
          </div>
        </header>

        <div role="tablist" className="grid grid-cols-3 rounded-xl bg-surface-high/80 p-[3px]">
          {(["everyone", "active", "answered"] as const).map((item) => (
            <button
              key={item}
              role="tab"
              type="button"
              aria-selected={view === item}
              onClick={() => setView(item)}
              className={cn(
                "h-8 rounded-[9px] text-[13px] font-semibold transition-all duration-300",
                view === item ? "bg-[#3a4260] text-parchment shadow-md" : "text-mist",
              )}
            >
              {item === "everyone" ? "Everyone" : item === "active" ? "Lifted up" : "Answered"}
            </button>
          ))}
        </div>

        {view === "everyone" ? (
          <WallFeed />
        ) : items.length === 0 ? (
          <div key={view} className="emmaus-card mt-3 flex animate-rise flex-col items-center gap-3.5 p-7 text-center">
            {view === "active" ? <HandHeart className="h-9 w-9 text-gold" /> : <Sun className="h-9 w-9 text-gold" />}
            <p className="font-serif text-xl font-semibold text-parchment">
              {view === "active" ? "Nothing on your heart yet" : "Answers will gather here"}
            </p>
            <p className="font-serif text-[15px] italic leading-relaxed text-mist">
              {view === "active"
                ? "“In every thing by prayer and supplication with thanksgiving let your requests be made known unto God.” — Phil. 4:6"
                : "When God answers a prayer, mark it answered and write down how. Over time this becomes a record of His faithfulness."}
            </p>
          </div>
        ) : (
          <ul key={view} className="space-y-3">
            {items.map((prayer, index) => (
              <li key={prayer.id} className="animate-rise" style={{ animationDelay: `${Math.min(index, 8) * 50}ms` }}>
                <PrayerRow prayer={prayer} onClick={() => setSelectedId(prayer.id)} />
              </li>
            ))}
          </ul>
        )}
      </div>

      {view !== "everyone" && (
        <button
          type="button"
          onClick={() => setComposing(true)}
          aria-label="New prayer"
          className="bg-gold-gradient pressable fixed bottom-[calc(var(--tabbar-height)+max(env(safe-area-inset-bottom),10px)+18px)] right-5 z-30 flex h-[58px] w-[58px] items-center justify-center rounded-full text-ink shadow-[0_10px_30px_-4px_rgba(214,122,67,0.55)] lg:bottom-10 lg:right-10"
        >
          <Plus className="h-6 w-6" strokeWidth={2.5} />
        </button>
      )}

      <PrayerEditorSheet open={composing} onOpenChange={setComposing} prayer={null} />
      <PrayerDetailSheet prayerId={selectedId} onClose={() => setSelectedId(null)} />
    </main>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-gold-gradient font-serif text-[28px] font-semibold tabular-nums">{value}</span>
      <span className="text-[15px] text-mist">{label}</span>
    </div>
  );
}

/** The shared wall: composer on top, everyone's prayers below, refreshed live. */
function WallFeed() {
  const identity = useMemo(wallIdentity, []);
  const { displayName } = useSettings();
  const start = useStartConversation();
  const queryClient = useQueryClient();
  const { data: prayers = [], isLoading } = useQuery({ queryKey: WALL_KEY, queryFn: wallApi.list, refetchInterval: 15_000 });

  const [draft, setDraft] = useState<string>("");
  const [anonymous, setAnonymous] = useState<boolean>(false);
  const [answerId, setAnswerId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const draftRef = useRef<HTMLTextAreaElement>(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey: WALL_KEY });

  const cast = useMutation({
    mutationFn: (text: string) =>
      wallApi.cast(identity, { text, name: displayName.trim() || "A quiet pilgrim", anonymous }),
    onSuccess: () => {
      setDraft("");
      setAnonymous(false);
      void refresh();
      toast("Your prayer is on the wall.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const pray = useMutation({
    mutationFn: (prayerId: string) => wallApi.pray(identity, prayerId),
    onMutate: (prayerId) => {
      const previous = queryClient.getQueryData<WallPrayer[]>(WALL_KEY) ?? [];
      queryClient.setQueryData<WallPrayer[]>(
        WALL_KEY,
        previous.map((p) =>
          p.id === prayerId
            ? {
                ...p,
                prayedBy: p.prayedBy.includes(identity.userId)
                  ? p.prayedBy.filter((id) => id !== identity.userId)
                  : [...p.prayedBy, identity.userId],
              }
            : p,
        ),
      );
      return { previous };
    },
    onError: (error: Error, _prayerId, context) => {
      queryClient.setQueryData(WALL_KEY, context?.previous ?? []);
      toast.error(error.message);
    },
  });

  const answerMutation = useMutation({
    mutationFn: ({ prayerId, testimony }: { prayerId: string; testimony: string }) =>
      wallApi.answer(identity, prayerId, testimony),
    onSuccess: () => {
      setAnswerId(null);
      void refresh();
      toast("Given thanks — marked answered.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const reopenMutation = useMutation({
    mutationFn: (prayerId: string) => wallApi.reopen(identity, prayerId),
    onSuccess: () => void refresh(),
    onError: (error: Error) => toast.error(error.message),
  });

  const removeMutation = useMutation({
    mutationFn: (prayerId: string) => wallApi.remove(identity, prayerId),
    onSuccess: () => {
      setDeleteId(null);
      void refresh();
      toast("Removed from the wall.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const answeredPrayer = prayers.find((p) => p.id === answerId) ?? null;
  const canCast = draft.trim().length > 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="emmaus-card animate-rise flex flex-col gap-3 !rounded-[22px] p-4">
        <textarea
          ref={draftRef}
          rows={2}
          value={draft}
          maxLength={480}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && canCast) cast.mutate(draft.trim());
          }}
          placeholder="What’s on your heart? Everyone who opens Emmaus will see it here."
          className="w-full resize-none bg-transparent font-serif text-[18px] leading-relaxed text-parchment outline-none placeholder:text-faint"
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAnonymous((v) => !v)}
            aria-pressed={anonymous}
            className={cn(
              "pressable flex min-h-[38px] items-center gap-1.5 rounded-full border border-hairline px-3 text-[13px] font-medium",
              anonymous ? "bg-gold/10 text-gold" : "text-mist",
            )}
          >
            {anonymous ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {anonymous ? "Quietly" : "As yourself"}
          </button>
          <span className="flex-1 text-right text-xs tabular-nums text-faint">{draft.length > 0 && `${draft.length}/480`}</span>
          <button
            type="button"
            onClick={() => canCast && cast.mutate(draft.trim())}
            disabled={!canCast || cast.isPending}
            className="bg-gold-gradient pressable flex min-h-[38px] items-center gap-1.5 rounded-full px-4 text-[14px] font-semibold text-ink disabled:opacity-40"
          >
            <Flame className="h-4 w-4 fill-ink" /> Cast it
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="emmaus-card h-28 animate-pulse !rounded-[20px] opacity-50" />
          ))}
        </div>
      ) : prayers.length === 0 ? (
        <div className="emmaus-card mt-1 flex animate-rise flex-col items-center gap-3.5 p-7 text-center">
          <HandHeart className="h-9 w-9 text-gold" />
          <p className="font-serif text-xl font-semibold text-parchment">The wall is quiet</p>
          <p className="font-serif text-[15px] italic leading-relaxed text-mist">
            “Cast thy burden upon the LORD, and he shall sustain thee.” — Ps. 55:22
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {prayers.map((prayer, index) => (
            <li key={prayer.id} className="animate-rise" style={{ animationDelay: `${Math.min(index, 8) * 50}ms` }}>
              <WallCard
                prayer={prayer}
                mine={prayer.userId === identity.userId}
                iPrayed={prayer.prayedBy.includes(identity.userId)}
                onPray={() => pray.mutate(prayer.id)}
                onPrayWithEmmaus={() =>
                  start(
                    `Please pray with me about this: ${prayer.text} Write a heartfelt prayer I can pray in my own words, and share one Scripture that speaks to it.`,
                  )
                }
                onAnswer={() => setAnswerId(prayer.id)}
                onReopen={() => reopenMutation.mutate(prayer.id)}
                onDelete={() => setDeleteId(prayer.id)}
              />
            </li>
          ))}
        </ul>
      )}

      <WallAnswerSheet
        prayer={answeredPrayer}
        pending={answerMutation.isPending}
        onClose={() => setAnswerId(null)}
        onConfirm={(testimony) => answerId && answerMutation.mutate({ prayerId: answerId, testimony })}
      />

      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent className="rounded-[24px] border-hairline bg-surface-high">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif text-xl text-parchment">Remove this prayer?</AlertDialogTitle>
            <AlertDialogDescription className="text-mist">It will be taken down from the wall for everyone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full border-hairline bg-surface text-parchment hover:bg-surface hover:text-parchment">
              Keep it
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && removeMutation.mutate(deleteId)} className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function WallCard({
  prayer,
  mine,
  iPrayed,
  onPray,
  onPrayWithEmmaus,
  onAnswer,
  onReopen,
  onDelete,
}: {
  prayer: WallPrayer;
  mine: boolean;
  iPrayed: boolean;
  onPray: () => void;
  onPrayWithEmmaus: () => void;
  onAnswer: () => void;
  onReopen: () => void;
  onDelete: () => void;
}) {
  const answered = prayer.answeredAt !== null;
  const shownName = prayer.anonymous ? "A quiet pilgrim" : prayer.name;
  const initial = prayer.anonymous ? null : shownName.trim().charAt(0).toUpperCase() || "·";

  return (
    <article className="emmaus-card !rounded-[20px] p-4">
      <div className="flex items-center gap-2.5">
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[14px] font-semibold",
            prayer.anonymous ? "bg-surface-high text-mist" : "bg-gold-gradient text-ink",
          )}
        >
          {initial ?? <Sparkles className="h-4 w-4" />}
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-[14px] font-semibold text-parchment">
            {shownName}
            {mine && <span className="ml-1.5 rounded-full bg-gold/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gold">you</span>}
          </p>
          <p className="text-xs text-faint">{timeAgo(prayer.createdAt)}</p>
        </div>
        {mine && (
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Prayer options"
              className="pressable flex h-8 w-8 items-center justify-center rounded-full text-mist hover:bg-white/5"
            >
              <Ellipsis className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-2xl border-hairline bg-surface-high p-1.5 text-parchment">
              {answered ? (
                <DropdownMenuItem className="gap-2 rounded-xl py-2.5" onSelect={onReopen}>
                  <Undo2 className="h-4 w-4" /> Move back to lifted up
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem className="gap-2 rounded-xl py-2.5" onSelect={onAnswer}>
                  <BadgeCheck className="h-4 w-4" /> Mark as answered
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator className="bg-hairline" />
              <DropdownMenuItem className="gap-2 rounded-xl py-2.5 text-destructive focus:text-destructive" onSelect={onDelete}>
                <Trash2 className="h-4 w-4" /> Remove from wall
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <p className="mt-3 whitespace-pre-wrap font-serif text-[17px] leading-relaxed text-parchment">{prayer.text}</p>

      {answered && (
        <div className="mt-3 rounded-[16px] border border-sage/30 bg-sage/[0.08] p-3.5">
          <p className="flex items-center gap-1.5 text-[13px] font-semibold text-sage">
            <BadgeCheck className="h-3.5 w-3.5" /> Answered {timeAgo(prayer.answeredAt ?? 0)}
          </p>
          {prayer.testimony && <p className="mt-1.5 font-serif text-[15px] italic leading-relaxed text-parchment">{prayer.testimony}</p>}
        </div>
      )}

      <div className="mt-3 flex items-center gap-1.5">
        <button
          type="button"
          onClick={onPray}
          aria-pressed={iPrayed}
          className={cn(
            "pressable flex min-h-[40px] items-center gap-2 rounded-full border border-hairline px-3.5 text-[14px] font-semibold transition-colors",
            iPrayed ? "border-gold/40 bg-gold/10 text-gold" : "text-mist hover:bg-white/5",
          )}
        >
          <HandHeart className={cn("h-[17px] w-[17px]", iPrayed && "fill-gold/30")} />
          {prayer.prayedBy.length > 0 ? `Prayed · ${prayer.prayedBy.length}` : "Pray"}
        </button>
        <button
          type="button"
          onClick={onPrayWithEmmaus}
          className="pressable flex min-h-[40px] items-center gap-2 rounded-full px-3 text-[14px] font-medium text-mist hover:bg-white/5"
        >
          <Flame className="h-4 w-4" /> With Emmaus
        </button>
      </div>
    </article>
  );
}

function WallAnswerSheet({
  prayer,
  pending,
  onClose,
  onConfirm,
}: {
  prayer: WallPrayer | null;
  pending: boolean;
  onClose: () => void;
  onConfirm: (testimony: string) => void;
}) {
  const [testimony, setTestimony] = useState<string>("");

  useEffect(() => {
    if (prayer) setTestimony("");
  }, [prayer]);

  return (
    <EmmausSheet
      open={prayer !== null}
      onOpenChange={(next) => !next && onClose()}
      title="Mark as answered"
      leading={
        <SheetAction tone="mist" onClick={onClose}>
          Cancel
        </SheetAction>
      }
      trailing={
        <SheetAction onClick={() => onConfirm(testimony.trim())} disabled={pending}>
          {pending ? "Saving…" : "Give thanks"}
        </SheetAction>
      }
    >
      <div className="space-y-4 p-5">
        <p className="font-serif text-[17px] leading-relaxed text-parchment">{prayer?.text}</p>
        <textarea
          rows={4}
          autoFocus
          value={testimony}
          onChange={(e) => setTestimony(e.target.value)}
          placeholder="How did God answer? (optional — shared with the wall)"
          className="emmaus-card w-full resize-none !rounded-2xl p-3.5 font-serif text-[17px] text-parchment outline-none placeholder:text-faint"
        />
        <p className="text-xs leading-relaxed text-faint">Your testimony stays beside the prayer to encourage everyone who prayed.</p>
      </div>
    </EmmausSheet>
  );
}

function PrayerRow({ prayer, onClick }: { prayer: Prayer; onClick: () => void }) {
  const category = categoryInfo(prayer.category);
  const answered = prayer.answeredAt !== null;
  const Icon = answered ? BadgeCheck : category.icon;

  const caption = useMemo<string>(() => {
    if (prayer.answeredAt !== null) {
      const days = Math.max(Math.floor((prayer.answeredAt - prayer.createdAt) / DAY), 0);
      return `Answered ${shortDate(prayer.answeredAt)} · after ${days} day${days === 1 ? "" : "s"}`;
    }
    return `${category.title} · ${relativeDay(prayer.createdAt)}`;
  }, [prayer, category.title]);

  const snippet = answered && prayer.testimony ? prayer.testimony : prayer.details;

  return (
    <button type="button" onClick={onClick} className="emmaus-card pressable flex w-full items-start gap-3.5 !rounded-[20px] p-4 text-left">
      <span
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
          answered ? "bg-sage/[0.12] text-sage" : "bg-gold/[0.12] text-gold",
        )}
      >
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <span className="min-w-0 flex-1 space-y-1">
        <span className="line-clamp-2 block font-serif text-[17px] font-semibold text-parchment">{prayer.title}</span>
        {snippet && (
          <span className={cn("line-clamp-2 block text-[15px] text-mist", answered && prayer.testimony && "italic")}>{snippet}</span>
        )}
        <span className="block text-xs text-faint">{caption}</span>
      </span>
    </button>
  );
}

function PrayerEditorSheet({
  open,
  onOpenChange,
  prayer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prayer: Prayer | null;
}) {
  const store = usePrayers();
  const [title, setTitle] = useState<string>("");
  const [details, setDetails] = useState<string>("");
  const [category, setCategory] = useState<PrayerCategory>("personal");
  const titleRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(prayer?.title ?? "");
    setDetails(prayer?.details ?? "");
    setCategory(prayer?.category ?? "personal");
    if (!prayer) setTimeout(() => titleRef.current?.focus(), 250);
  }, [open, prayer]);

  const save = () => {
    const base: Prayer = prayer ?? {
      id: uuid(),
      title: "",
      details: "",
      category,
      createdAt: Date.now(),
      answeredAt: null,
      testimony: "",
    };
    store.save({ ...base, title: title.trim(), details: details.trim(), category });
    onOpenChange(false);
  };

  return (
    <EmmausSheet
      open={open}
      onOpenChange={onOpenChange}
      title={prayer ? "Edit Prayer" : "New Prayer"}
      leading={
        <SheetAction tone="mist" onClick={() => onOpenChange(false)}>
          Cancel
        </SheetAction>
      }
      trailing={
        <SheetAction onClick={save} disabled={!title.trim()}>
          Save
        </SheetAction>
      }
    >
      <div className="space-y-[22px] p-5">
        <div className="space-y-2">
          <Eyebrow>What’s on your heart</Eyebrow>
          <textarea
            ref={titleRef}
            rows={2}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Wisdom for a new job"
            className="w-full resize-none bg-transparent font-serif text-[24px] font-medium leading-snug text-parchment outline-none placeholder:text-faint"
          />
        </div>
        <div className="space-y-2">
          <Eyebrow>Details</Eyebrow>
          <textarea
            rows={5}
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="Write freely — this stays on your device."
            className="emmaus-card w-full resize-none !rounded-2xl p-3.5 font-serif text-[17px] leading-relaxed text-parchment outline-none placeholder:text-faint focus:ring-1 focus:ring-gold/40"
          />
        </div>
        <div className="space-y-2.5">
          <Eyebrow>Category</Eyebrow>
          <div className="grid grid-cols-2 gap-2.5">
            {PRAYER_CATEGORIES.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setCategory(item.id)}
                className={cn(
                  "pressable flex min-h-[44px] items-center justify-center gap-1.5 rounded-full border border-hairline text-[15px] font-medium",
                  category === item.id ? "bg-gold-gradient text-ink" : "bg-surface text-parchment",
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.title}
              </button>
            ))}
          </div>
        </div>
      </div>
    </EmmausSheet>
  );
}

function PrayerDetailSheet({ prayerId, onClose }: { prayerId: string | null; onClose: () => void }) {
  const store = usePrayers();
  const start = useStartConversation();
  const prayer = prayerId ? store.prayer(prayerId) : null;

  const [testimony, setTestimony] = useState<string>("");
  const [marking, setMarking] = useState<boolean>(false);
  const [editing, setEditing] = useState<boolean>(false);
  const [celebrate, setCelebrate] = useState<number>(0);

  useEffect(() => {
    setTestimony("");
    setMarking(false);
  }, [prayerId]);

  const open = prayerId !== null;

  return (
    <>
      <EmmausSheet
        open={open && !editing}
        onOpenChange={(next) => !next && onClose()}
        title={prayer?.title ?? "Prayer"}
        hideTitle
        leading={
          prayer && (
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label="More"
                className="pressable flex h-9 w-9 items-center justify-center rounded-full text-mist hover:bg-white/5"
              >
                <Ellipsis className="h-5 w-5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56 rounded-2xl border-hairline bg-surface-high p-1.5 text-parchment">
                <DropdownMenuItem className="gap-2 rounded-xl py-2.5" onSelect={() => setEditing(true)}>
                  <Pencil className="h-4 w-4" /> Edit
                </DropdownMenuItem>
                {prayer.answeredAt !== null && (
                  <DropdownMenuItem className="gap-2 rounded-xl py-2.5" onSelect={() => store.reopen(prayer.id)}>
                    <Undo2 className="h-4 w-4" /> Move back to active
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator className="bg-hairline" />
                <DropdownMenuItem
                  className="gap-2 rounded-xl py-2.5 text-destructive focus:text-destructive"
                  onSelect={() => {
                    store.remove(prayer.id);
                    onClose();
                  }}
                >
                  <Trash2 className="h-4 w-4" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )
        }
        trailing={<SheetAction onClick={onClose}>Done</SheetAction>}
      >
        {prayer ? (
          <div className="space-y-5 px-5 pb-3 pt-1">
            <div className="space-y-2">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-gold">
                {(() => {
                  const info = categoryInfo(prayer.category);
                  return (
                    <>
                      <info.icon className="h-3.5 w-3.5" /> {info.title}
                    </>
                  );
                })()}
              </p>
              <h2 className="font-serif text-[28px] font-semibold leading-tight text-parchment">{prayer.title}</h2>
              <p className="text-xs text-faint">Lifted up {longDate(prayer.createdAt)}</p>
            </div>

            {prayer.details && (
              <p className="whitespace-pre-wrap font-serif text-[17px] leading-relaxed text-mist">{prayer.details}</p>
            )}

            {prayer.answeredAt !== null ? (
              <div className="animate-rise space-y-2.5 rounded-[20px] border border-sage/30 bg-sage/[0.08] p-[18px]">
                <p className="flex items-center gap-2 text-[15px] font-semibold text-sage">
                  <BadgeCheck key={celebrate} className={cn("h-4 w-4", celebrate > 0 && "animate-in zoom-in-50 duration-500")} />
                  Answered {longDate(prayer.answeredAt)}
                </p>
                <p className="whitespace-pre-wrap font-serif text-[17px] italic leading-relaxed text-parchment">
                  {prayer.testimony || "“Great is thy faithfulness.” — Lam. 3:23"}
                </p>
              </div>
            ) : marking ? (
              <div className="animate-rise space-y-3">
                <Eyebrow className="text-sage">How did God answer?</Eyebrow>
                <textarea
                  rows={4}
                  autoFocus
                  value={testimony}
                  onChange={(e) => setTestimony(e.target.value)}
                  placeholder="Write your testimony (optional)"
                  className="emmaus-card w-full resize-none !rounded-2xl p-3.5 font-serif text-[17px] text-parchment outline-none placeholder:text-faint"
                />
                <div className="flex gap-2.5">
                  <button
                    type="button"
                    onClick={() => setMarking(false)}
                    className="pressable min-h-[48px] flex-1 rounded-[14px] bg-surface text-[15px] font-semibold text-mist"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      store.markAnswered(prayer.id, testimony);
                      setCelebrate((c) => c + 1);
                      setMarking(false);
                    }}
                    className="pressable min-h-[48px] flex-1 rounded-[14px] bg-sage text-[15px] font-semibold text-ink"
                  >
                    Give thanks
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    const more = prayer.details ? ` Here’s more: ${prayer.details}` : "";
                    start(
                      `Please pray with me about this: ${prayer.title}.${more} Write a heartfelt prayer I can pray in my own words, and share one Scripture that speaks to it.`,
                    );
                    onClose();
                  }}
                  className="bg-gold-gradient pressable flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl text-[17px] font-semibold text-ink"
                >
                  <Flame className="h-[18px] w-[18px] fill-ink" /> Pray this with Emmaus
                </button>
                <button
                  type="button"
                  onClick={() => setMarking(true)}
                  className="pressable flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl border border-sage/30 bg-sage/10 text-[17px] font-semibold text-sage"
                >
                  <BadgeCheck className="h-[18px] w-[18px]" /> Mark as answered
                </button>
              </div>
            )}
          </div>
        ) : (
          <p className="p-10 text-center text-mist">Prayer removed</p>
        )}
      </EmmausSheet>

      <PrayerEditorSheet open={editing} onOpenChange={setEditing} prayer={prayer} />
    </>
  );
}
