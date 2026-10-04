import createContextHook from "@nkzw/create-context-hook";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { fetchModels, friendlyMessage, normalizeBaseURL, type LLMRequestConfig } from "@/lib/llm";
import { PERSONAS } from "@/lib/options";
import { loadString, saveString } from "@/lib/storage";
import type { Persona } from "@/lib/types";

export type ConnectionState =
  | { kind: "idle" }
  | { kind: "testing" }
  | { kind: "connected"; modelCount: number }
  | { kind: "failed"; message: string };

const KEYS = {
  server: "emmaus.settings.server",
  apiKey: "emmaus.settings.apiKey",
  model: "emmaus.settings.model",
  temperature: "emmaus.settings.temperature",
  persona: "emmaus.settings.persona",
  tradition: "emmaus.settings.tradition",
  translation: "emmaus.settings.translation",
  name: "emmaus.settings.name",
} as const;

function usePersisted(key: string, fallback: string): [string, (value: string) => void] {
  const [value, setValue] = useState<string>(() => loadString(key, fallback));
  const update = useCallback(
    (next: string) => {
      setValue(next);
      saveString(key, next);
    },
    [key],
  );
  return [value, update];
}

/** Server connection and companion preferences, persisted in localStorage. */
export const [SettingsProvider, useSettings] = createContextHook(() => {
  const [serverAddress, setServerAddressRaw] = usePersisted(KEYS.server, "");
  const [apiKey, setApiKey] = usePersisted(KEYS.apiKey, "");
  const [model, setModel] = usePersisted(KEYS.model, "");
  const [temperatureRaw, setTemperatureRaw] = usePersisted(KEYS.temperature, "0.7");
  const [personaRaw, setPersonaRaw] = usePersisted(KEYS.persona, "shepherd");
  const [tradition, setTradition] = usePersisted(KEYS.tradition, "Ecumenical");
  const [translation, setTranslation] = usePersisted(KEYS.translation, "ESV");
  const [displayName, setDisplayName] = usePersisted(KEYS.name, "");

  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [connection, setConnection] = useState<ConnectionState>({ kind: "idle" });

  const temperature = Number.isFinite(Number(temperatureRaw)) ? Number(temperatureRaw) : 0.7;
  const persona: Persona = PERSONAS.some((p) => p.id === personaRaw) ? (personaRaw as Persona) : "shepherd";

  const setServerAddress = useCallback(
    (value: string) => {
      setServerAddressRaw(value);
      setConnection({ kind: "idle" });
      setAvailableModels([]);
    },
    [setServerAddressRaw],
  );
  const setTemperature = useCallback((value: number) => setTemperatureRaw(String(value)), [setTemperatureRaw]);
  const setPersona = useCallback((value: Persona) => setPersonaRaw(value), [setPersonaRaw]);

  const baseURL = useMemo<string | null>(() => normalizeBaseURL(serverAddress), [serverAddress]);
  const hasServer = baseURL !== null;

  const requestConfig = useMemo<LLMRequestConfig | null>(() => {
    if (!baseURL || !model.trim()) return null;
    return { baseURL, apiKey, model, temperature };
  }, [baseURL, apiKey, model, temperature]);
  const isReady = requestConfig !== null;

  const modelRef = useRef<string>(model);
  modelRef.current = model;

  const testConnection = useCallback(async () => {
    if (!baseURL) {
      setConnection({ kind: "failed", message: "Enter a valid server address." });
      return;
    }
    setConnection({ kind: "testing" });
    try {
      const models = await fetchModels(baseURL, apiKey);
      setAvailableModels(models);
      if (!modelRef.current && models[0]) setModel(models[0]);
      setConnection({ kind: "connected", modelCount: models.length });
    } catch (error) {
      console.warn("Connection test failed");
      setConnection({ kind: "failed", message: friendlyMessage(error) });
    }
  }, [baseURL, apiKey, setModel]);

  // Auto-test once on launch when a server is configured (mirrors iOS).
  const didAutoTest = useRef<boolean>(false);
  useEffect(() => {
    if (didAutoTest.current || !baseURL) return;
    didAutoTest.current = true;
    void testConnection();
  }, [baseURL, testConnection]);

  const statusLabel = useMemo<string>(() => {
    switch (connection.kind) {
      case "connected":
        return model || "Connected";
      case "testing":
        return "Connecting…";
      case "failed":
        return "Offline";
      default:
        return hasServer ? model || "Choose a model" : "Not connected";
    }
  }, [connection.kind, model, hasServer]);

  /** Builds the scripture-grounded system prompt from the user's preferences. */
  const systemPrompt = useCallback((): string => {
    const style = PERSONAS.find((p) => p.id === persona)?.promptStyle ?? PERSONAS[0].promptStyle;
    const sections: string[] = [
      "You are Emmaus, a Christian AI companion named after the road to Emmaus (Luke 24), where the risen Jesus walked alongside two disciples and opened the Scriptures to them.",
      "Your purpose is to help people understand the Bible, grow in faith, pray, and bring their real lives before God.",
      `Theological stance: historic, orthodox Christianity as summarized in the Apostles' and Nicene Creeds. The person's tradition is ${tradition}; respect its emphases. On disputed matters (baptism, sacraments, end times, church governance, spiritual gifts) fairly present the major Christian views rather than declaring one the only answer.`,
      `Quote Scripture from the ${translation} when you are confident of the wording, and always give the reference (e.g. John 15:5). Never invent verses or misattribute quotations; if unsure of exact wording, paraphrase and say so.`,
      style,
      "Be warm, humble, and concise. Use short paragraphs and light Markdown (bold, italics) sparingly. No headings unless asked.",
      "You are not a replacement for a pastor, church community, or professional counselor; gently encourage those connections when appropriate.",
      "If someone mentions self-harm, suicide, abuse, or danger, respond with compassion, urge them to contact local emergency services or a crisis line (in the US, call or text 988), and encourage them to reach out to a trusted person right away.",
    ];
    const name = displayName.trim();
    if (name) sections.push(`The person you are speaking with is named ${name}.`);
    sections.push(
      `Today is ${new Date().toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}.`,
    );
    return sections.join("\n\n");
  }, [persona, tradition, translation, displayName]);

  return {
    serverAddress,
    setServerAddress,
    apiKey,
    setApiKey,
    model,
    setModel,
    temperature,
    setTemperature,
    persona,
    setPersona,
    tradition,
    setTradition,
    translation,
    setTranslation,
    displayName,
    setDisplayName,
    availableModels,
    connection,
    baseURL,
    hasServer,
    isReady,
    requestConfig,
    statusLabel,
    testConnection,
    systemPrompt,
  };
});
