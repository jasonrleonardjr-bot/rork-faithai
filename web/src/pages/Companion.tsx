import { ArrowUp, ArrowUpRight, Copy, History, SquarePen, Square, TriangleAlert, Trash2, Zap } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { CandleBackground, FlameAvatar, FlameMark } from "@/components/emmaus/Candle";
import { EmmausSheet } from "@/components/emmaus/Sheet";
import { StatusPill } from "@/components/emmaus/StatusPill";
import { useChatContext } from "@/hooks/use-chat-context";
import { isInsideReasoning, stripReasoning } from "@/lib/llm";
import { renderInline } from "@/lib/markdown";
import { CHAT_SUGGESTIONS } from "@/lib/options";
import type { ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useChat } from "@/state/chat";
import { useSettings } from "@/state/settings";

function relativeTime(ms: number): string {
  const diff = (ms - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  const abs = Math.abs(diff);
  if (abs < 60) return rtf.format(Math.round(diff), "second");
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  return rtf.format(Math.round(diff / 86400), "day");
}

export default function Companion() {
  const chat = useChat();
  const { isReady } = useSettings();
  const context = useChatContext();
  const navigate = useNavigate();

  const [draft, setDraft] = useState<string>("");
  const [historyOpen, setHistoryOpen] = useState<boolean>(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const lastContent = chat.messages[chat.messages.length - 1]?.content;
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [chat.messages.length, lastContent, chat.errorMessage]);

  // Auto-grow composer (1–6 lines).
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [draft]);

  const submit = useCallback(
    (text: string) => {
      if (!text.trim()) return;
      chat.send(text, context());
      setDraft("");
    },
    [chat, context],
  );

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      if (!chat.isStreaming) submit(draft);
    }
  };

  const canSend = draft.trim().length > 0;
  const isEmpty = chat.messages.length === 0;

  return (
    <main className="relative flex min-h-dvh flex-col">
      <CandleBackground intensity={isEmpty ? 1 : 0.55} />

      <header className="sticky top-0 z-30 flex items-center justify-between gap-2 bg-gradient-to-b from-ink/90 via-ink/60 to-transparent px-3 pb-4 pt-[max(env(safe-area-inset-top),10px)] backdrop-blur-[2px]">
        <button
          type="button"
          onClick={() => setHistoryOpen(true)}
          aria-label="Conversation history"
          className="pressable flex h-11 w-11 items-center justify-center rounded-full text-gold hover:bg-white/5"
        >
          <History className="h-5 w-5" />
        </button>
        <StatusPill />
        <button
          type="button"
          onClick={chat.newConversation}
          disabled={isEmpty}
          aria-label="New conversation"
          className="pressable flex h-11 w-11 items-center justify-center rounded-full text-gold hover:bg-white/5 disabled:opacity-30"
        >
          <SquarePen className="h-5 w-5" />
        </button>
      </header>

      <div className="mx-auto w-full max-w-[760px] flex-1 px-4">
        {isEmpty ? (
          <div className="flex flex-col items-center gap-[22px] pb-8 pt-6 text-center sm:pt-14">
            <FlameMark size={52} className="mb-2" />
            <div className="space-y-2.5">
              <h1 className="font-serif text-[34px] font-semibold text-parchment">Walk with me</h1>
              <p className="font-serif text-[17px] leading-relaxed text-mist">
                Ask about Scripture, bring a burden,
                <br />
                or wrestle with a hard question.
              </p>
            </div>
            <div className="mt-2.5 grid w-full gap-2.5 sm:grid-cols-2">
              {CHAT_SUGGESTIONS.map((suggestion, index) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => submit(suggestion)}
                  className="emmaus-card pressable flex animate-rise items-center justify-between gap-2 !rounded-2xl px-4 py-3.5 text-left text-[15px] text-parchment"
                  style={{ animationDelay: `${index * 70}ms` }}
                >
                  {suggestion}
                  <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-gold" />
                </button>
              ))}
            </div>
            {!isReady && (
              <Link to="/settings" className="flex min-h-[44px] items-center gap-1.5 text-[13px] font-semibold text-gold">
                <Zap className="h-4 w-4" /> Connect your model server first
              </Link>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-[18px] py-3">
            {chat.messages.map((message, index) => (
              <MessageRow
                key={message.id}
                message={message}
                isStreaming={chat.isStreaming && index === chat.messages.length - 1}
              />
            ))}
            {chat.errorMessage && (
              <ErrorCard
                message={chat.errorMessage}
                onRetry={() => chat.retry(context())}
                onSettings={() => navigate("/settings")}
              />
            )}
          </div>
        )}
        <div ref={bottomRef} className="h-px" />
      </div>

      <div className="sticky bottom-[calc(var(--tabbar-height)+max(env(safe-area-inset-bottom),10px)+10px)] z-30 mx-auto w-full max-w-[760px] px-3.5 pb-2 lg:bottom-0 lg:pb-6">
        <div className="glass flex items-end gap-2.5 rounded-[26px]">
          <textarea
            ref={inputRef}
            rows={1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Ask, share, or seek…"
            aria-label="Message"
            className="no-scrollbar max-h-40 min-h-[48px] flex-1 resize-none bg-transparent py-[13px] pl-[18px] text-[17px] leading-[22px] text-parchment outline-none placeholder:text-faint"
          />
          <button
            type="button"
            onClick={() => (chat.isStreaming ? chat.stop() : submit(draft))}
            disabled={!canSend && !chat.isStreaming}
            aria-label={chat.isStreaming ? "Stop" : "Send"}
            className={cn(
              "bg-gold-gradient pressable mb-1.5 mr-1.5 flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full text-ink transition-opacity",
              !canSend && !chat.isStreaming && "opacity-35",
            )}
          >
            {chat.isStreaming ? <Square className="h-3.5 w-3.5 fill-ink" /> : <ArrowUp className="h-[18px] w-[18px]" strokeWidth={2.8} />}
          </button>
        </div>
      </div>
      <div className="h-[calc(var(--tabbar-height)+max(env(safe-area-inset-bottom),10px)+4px)] lg:hidden" />

      <EmmausSheet open={historyOpen} onOpenChange={setHistoryOpen} title="Conversations">
        <HistoryList onPicked={() => setHistoryOpen(false)} />
      </EmmausSheet>
    </main>
  );
}

function MessageRow({ message, isStreaming }: { message: ChatMessage; isStreaming: boolean }) {
  if (message.role === "user") {
    return (
      <div className="flex animate-rise justify-end pl-12">
        <p className="whitespace-pre-wrap rounded-[20px] border border-gold/20 bg-surface-high px-4 py-3 text-[17px] leading-snug text-parchment">
          {message.content}
        </p>
      </div>
    );
  }

  const visible = stripReasoning(message.content);
  const reasoning = isInsideReasoning(message.content);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(visible);
      toast("Copied");
    } catch {
      // clipboard unavailable
    }
  };

  return (
    <div className="group flex animate-rise items-start gap-3">
      <FlameAvatar />
      <div className="min-w-0 flex-1 space-y-2 pt-1">
        {visible ? (
          <>
            <p className="whitespace-pre-wrap font-serif text-[18px] leading-[1.6] text-parchment">{renderInline(visible)}</p>
            {isStreaming && reasoning && <ThinkingIndicator label="Reflecting" />}
            {!isStreaming && (
              <button
                type="button"
                onClick={copy}
                className="flex items-center gap-1 text-xs text-faint opacity-100 transition-opacity hover:text-mist sm:opacity-0 sm:group-hover:opacity-100"
              >
                <Copy className="h-3 w-3" /> Copy
              </button>
            )}
          </>
        ) : (
          <ThinkingIndicator label={reasoning ? "Reflecting" : "Listening"} />
        )}
      </div>
    </div>
  );
}

function ThinkingIndicator({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 py-1" aria-label={`${label}…`}>
      <div className="flex gap-[5px]">
        {[0, 1, 2].map((i) => (
          <span key={i} className="h-1.5 w-1.5 animate-thinking-dot rounded-full bg-gold" style={{ animationDelay: `${i * 180}ms` }} />
        ))}
      </div>
      <span className="font-serif text-[15px] italic text-faint">{label}</span>
    </div>
  );
}

function ErrorCard({ message, onRetry, onSettings }: { message: string; onRetry: () => void; onSettings: () => void }) {
  return (
    <div className="animate-rise space-y-3 rounded-[18px] border border-ember/30 bg-ember/[0.08] p-4">
      <p className="flex items-center gap-2 text-[15px] font-semibold text-ember">
        <TriangleAlert className="h-4 w-4" /> Something went wrong
      </p>
      <p className="text-[15px] text-mist">{message}</p>
      <div className="flex gap-2.5">
        <button type="button" onClick={onRetry} className="bg-gold-gradient pressable h-9 rounded-full px-3.5 text-[15px] font-semibold text-ink">
          Try again
        </button>
        <button type="button" onClick={onSettings} className="pressable h-9 rounded-full bg-surface-high px-3.5 text-[15px] font-semibold text-parchment">
          Settings
        </button>
      </div>
    </div>
  );
}

function HistoryList({ onPicked }: { onPicked: () => void }) {
  const chat = useChat();

  if (chat.conversations.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
        <FlameMark size={30} />
        <p className="font-serif text-xl font-semibold text-parchment">No conversations yet</p>
        <p className="text-[15px] text-mist">Your walks with Emmaus will appear here.</p>
      </div>
    );
  }

  return (
    <ul className="space-y-2 px-4 pb-2 pt-1">
      {chat.conversations.map((conversation) => (
        <li
          key={conversation.id}
          className={cn(
            "group flex items-center gap-2 rounded-2xl pr-2",
            conversation.id === chat.currentId ? "bg-gold/10" : "bg-surface/60",
          )}
        >
          <button
            type="button"
            onClick={() => {
              chat.open(conversation);
              onPicked();
            }}
            className="pressable min-w-0 flex-1 px-4 py-3 text-left"
          >
            <span className="line-clamp-2 block font-serif text-[17px] font-medium text-parchment">{conversation.title}</span>
            <span className="block text-xs text-faint">{relativeTime(conversation.updatedAt)}</span>
          </button>
          <button
            type="button"
            onClick={() => chat.remove(conversation)}
            aria-label="Delete conversation"
            className="pressable flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-faint hover:bg-ember/10 hover:text-ember"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </li>
      ))}
    </ul>
  );
}
