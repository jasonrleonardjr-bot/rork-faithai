import { CircleCheck, CircleX, Cpu, KeyRound, Landmark, LoaderCircle, BookMarked, Server, Trash2, UserRound, WandSparkles, Zap } from "lucide-react";
import { useState, type ReactNode } from "react";

import { CandleBackground, FlameMark } from "@/components/emmaus/Candle";
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
import { isMixedContent } from "@/lib/llm";
import { PERSONAS, TRADITIONS, TRANSLATIONS } from "@/lib/options";
import { cn } from "@/lib/utils";
import { useChat } from "@/state/chat";
import { useSettings } from "@/state/settings";

export default function Settings() {
  const s = useSettings();
  const chat = useChat();
  const [confirmClear, setConfirmClear] = useState<boolean>(false);

  const mixed = isMixedContent(s.baseURL);

  return (
    <main className="relative">
      <CandleBackground intensity={0.5} />
      <div className="pb-tabbar mx-auto flex max-w-[640px] flex-col gap-7 px-5 pt-[max(env(safe-area-inset-top),20px)] lg:pt-12">
        <h1 className="animate-rise pt-3 font-serif text-[34px] font-semibold text-parchment">Settings</h1>

        <div className="flex animate-rise items-center gap-3">
          <FlameMark size={30} className="shrink-0" />
          <div className="space-y-1">
            <p className="font-serif text-xl font-semibold text-parchment">Your own AI, kept close</p>
            <p className="text-[13px] leading-relaxed text-mist">
              Works with any OpenAI-compatible server — Ollama, LM Studio, llama.cpp, vLLM, or your own hybrid.
            </p>
          </div>
        </div>

        <Section
          title="Model server"
          footer={
            s.connection.kind === "connected" ? (
              <span className="text-sage">
                Connected · {s.connection.modelCount} model{s.connection.modelCount === 1 ? "" : "s"} available at {s.baseURL}
              </span>
            ) : s.connection.kind === "failed" ? (
              <span className="text-ember">{s.connection.message}</span>
            ) : mixed ? (
              <span className="text-ember">Browsers block plain http from secure pages. Use https (Tailscale, Cloudflare Tunnel, ngrok) or localhost.</span>
            ) : s.baseURL ? (
              <>Requests go to {s.baseURL}/chat/completions. Your server must allow browser requests (CORS).</>
            ) : (
              <>Use an https address (Tailscale, Cloudflare Tunnel, or ngrok work great). “/v1” is added automatically if no path is given.</>
            )
          }
        >
          <Field label="Server address" icon={Server}>
            <input
              value={s.serverAddress}
              onChange={(e) => s.setServerAddress(e.target.value)}
              placeholder="https://my-server.ts.net"
              inputMode="url"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              className="w-full bg-transparent text-[17px] text-parchment outline-none placeholder:text-faint"
            />
          </Field>
          <Field label="API key" icon={KeyRound}>
            <input
              type="password"
              value={s.apiKey}
              onChange={(e) => s.setApiKey(e.target.value)}
              placeholder="Optional"
              autoComplete="off"
              className="w-full bg-transparent text-[17px] text-parchment outline-none placeholder:text-faint"
            />
          </Field>
          <button
            type="button"
            onClick={() => void s.testConnection()}
            disabled={!s.hasServer || s.connection.kind === "testing"}
            className="flex min-h-[48px] w-full items-center justify-between px-4 text-[17px] text-gold transition-opacity disabled:opacity-40"
          >
            <span className="flex items-center gap-2.5">
              <Zap className="h-[18px] w-[18px]" /> Test connection
            </span>
            {s.connection.kind === "testing" && <LoaderCircle className="h-4 w-4 animate-spin" />}
            {s.connection.kind === "connected" && <CircleCheck className="h-5 w-5 text-sage" />}
            {s.connection.kind === "failed" && <CircleX className="h-5 w-5 text-ember" />}
          </button>
        </Section>

        <Section title="Model">
          {s.availableModels.length === 0 ? (
            <Field label="Model" icon={Cpu}>
              <input
                value={s.model}
                onChange={(e) => s.setModel(e.target.value)}
                placeholder="e.g. llama3.1:8b"
                autoCapitalize="off"
                spellCheck={false}
                className="w-full bg-transparent text-[17px] text-parchment outline-none placeholder:text-faint"
              />
            </Field>
          ) : (
            <SelectRow
              label="Model"
              icon={Cpu}
              value={s.model}
              onChange={s.setModel}
              options={s.model && !s.availableModels.includes(s.model) ? [s.model, ...s.availableModels] : s.availableModels}
            />
          )}
          <div className="space-y-2 px-4 py-3">
            <div className="flex items-center justify-between text-[17px]">
              <span className="flex items-center gap-2.5 text-parchment">
                <WandSparkles className="h-[18px] w-[18px] text-mist" /> Creativity
              </span>
              <span className="tabular-nums text-gold">{s.temperature.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={1.5}
              step={0.1}
              value={s.temperature}
              onChange={(e) => s.setTemperature(Number(e.target.value))}
              aria-label="Creativity"
              className="w-full accent-[#E3C07F]"
            />
            <div className="flex justify-between text-[11px] text-faint">
              <span>Faithful</span>
              <span>Expressive</span>
            </div>
          </div>
        </Section>

        <Section title="Companion voice">
          {PERSONAS.map((persona) => (
            <button
              key={persona.id}
              type="button"
              onClick={() => s.setPersona(persona.id)}
              className="flex w-full items-center gap-3.5 px-4 py-3 text-left transition-colors hover:bg-white/[0.02]"
            >
              <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] bg-gold/10">
                <persona.icon className="h-[18px] w-[18px] text-gold" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-serif text-[17px] font-semibold text-parchment">{persona.title}</span>
                <span className="block text-xs text-mist">{persona.subtitle}</span>
              </span>
              <CircleCheck
                className={cn(
                  "h-5 w-5 fill-gold stroke-midnight transition-all duration-300",
                  s.persona === persona.id ? "scale-100 opacity-100" : "scale-50 opacity-0",
                )}
              />
            </button>
          ))}
        </Section>

        <Section
          title="Personalize"
          footer="Emmaus holds to historic Christian faith (the Apostles’ and Nicene Creeds) and presents major views fairly on disputed questions."
        >
          <Field label="Your name" icon={UserRound}>
            <input
              value={s.displayName}
              onChange={(e) => s.setDisplayName(e.target.value)}
              placeholder="Optional"
              autoComplete="given-name"
              className="w-full bg-transparent text-[17px] text-parchment outline-none placeholder:text-faint"
            />
          </Field>
          <SelectRow label="Tradition" icon={Landmark} value={s.tradition} onChange={s.setTradition} options={[...TRADITIONS]} />
          <SelectRow label="Preferred translation" icon={BookMarked} value={s.translation} onChange={s.setTranslation} options={[...TRANSLATIONS]} />
        </Section>

        <Section
          title="Privacy"
          footer="Conversations and prayers are stored only in this browser. Messages are sent only to the server you configure above."
        >
          <button
            type="button"
            onClick={() => setConfirmClear(true)}
            disabled={chat.conversations.length === 0}
            className="flex min-h-[48px] w-full items-center gap-2.5 px-4 text-[17px] text-destructive disabled:opacity-40"
          >
            <Trash2 className="h-[18px] w-[18px]" /> Clear conversation history
          </button>
        </Section>
      </div>

      <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
        <AlertDialogContent className="rounded-[24px] border-hairline bg-surface-high">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif text-xl text-parchment">Delete all conversations?</AlertDialogTitle>
            <AlertDialogDescription className="text-mist">This can’t be undone. Your prayer journal is not affected.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full border-hairline bg-surface text-parchment hover:bg-surface hover:text-parchment">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={chat.deleteAll} className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete all
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}

function Section({ title, footer, children }: { title: string; footer?: ReactNode; children: ReactNode }) {
  return (
    <section className="animate-rise space-y-2">
      <h2 className="px-4 text-[13px] font-medium uppercase tracking-wide text-faint">{title}</h2>
      <div className="divide-y divide-hairline overflow-hidden rounded-[18px] bg-surface/90">{children}</div>
      {footer && <p className="px-4 text-[13px] leading-relaxed text-faint">{footer}</p>}
    </section>
  );
}

function Field({ label, icon: Icon, children }: { label: string; icon: React.ComponentType<{ className?: string }>; children: ReactNode }) {
  return (
    <label className="block space-y-1.5 px-4 py-3">
      <span className="flex items-center gap-1.5 text-xs font-semibold text-mist">
        <Icon className="h-3.5 w-3.5" /> {label}
      </span>
      {children}
    </label>
  );
}

function SelectRow({
  label,
  icon: Icon,
  value,
  onChange,
  options,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <label className="flex min-h-[48px] items-center justify-between gap-3 px-4">
      <span className="flex items-center gap-2.5 text-[17px] text-parchment">
        <Icon className="h-[18px] w-[18px] text-mist" /> {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="max-w-[55%] cursor-pointer truncate bg-transparent text-right text-[17px] text-gold outline-none [&>option]:bg-surface-high [&>option]:text-parchment"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}
