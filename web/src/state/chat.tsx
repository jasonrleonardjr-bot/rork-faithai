import createContextHook from "@nkzw/create-context-hook";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  EMPTY_RESPONSE,
  friendlyMessage,
  NOT_CONFIGURED,
  stripReasoning,
  streamChat,
  type LLMRequestConfig,
  type WireMessage,
} from "@/lib/llm";
import { loadJSON, saveJSON } from "@/lib/storage";
import { uuid, type ChatMessage, type Conversation } from "@/lib/types";

const STORE_KEY = "emmaus.conversations";

export interface ChatContext {
  config: LLMRequestConfig | null;
  systemPrompt: string;
}

/** Manages the active conversation, streaming replies, and saved conversation history. */
export const [ChatProvider, useChat] = createContextHook(() => {
  const [conversations, setConversations] = useState<Conversation[]>(() => loadJSON<Conversation[]>(STORE_KEY, []));
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  const currentIdRef = useRef<string | null>(null);
  messagesRef.current = messages;
  currentIdRef.current = currentId;

  useEffect(() => {
    saveJSON(STORE_KEY, conversations);
  }, [conversations]);

  const persist = useCallback((snapshot: ChatMessage[]) => {
    const firstUser = snapshot.find((m) => m.role === "user");
    if (!firstUser) return;
    const id = currentIdRef.current ?? uuid();
    currentIdRef.current = id;
    setCurrentId(id);
    const conversation: Conversation = {
      id,
      title: firstUser.content.slice(0, 60),
      messages: snapshot,
      updatedAt: Date.now(),
    };
    setConversations((prev) => [conversation, ...prev.filter((c) => c.id !== id)]);
  }, []);

  const runCompletion = useCallback(
    async (base: ChatMessage[], ctx: ChatContext) => {
      if (!ctx.config) {
        setErrorMessage(NOT_CONFIGURED);
        persist(base);
        return;
      }
      const history: WireMessage[] = base
        .slice(-24)
        .map((m) => ({ role: m.role, content: m.role === "assistant" ? stripReasoning(m.content) : m.content }))
        .filter((m) => m.content.length > 0);
      const wire: WireMessage[] = [{ role: "system", content: ctx.systemPrompt }, ...history];

      const reply: ChatMessage = { id: uuid(), role: "assistant", content: "", createdAt: Date.now() };
      let working: ChatMessage[] = [...base, reply];
      setMessages(working);
      setIsStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;
      let content = "";
      try {
        for await (const delta of streamChat(ctx.config, wire, controller.signal)) {
          content += delta;
          working = working.map((m) => (m.id === reply.id ? { ...m, content } : m));
          setMessages(working);
        }
        if (!controller.signal.aborted && !stripReasoning(content)) throw new Error(EMPTY_RESPONSE);
      } catch (error) {
        const cancelled = controller.signal.aborted || (error instanceof DOMException && error.name === "AbortError");
        if (!cancelled) {
          console.warn("Chat stream failed");
          setErrorMessage(friendlyMessage(error));
        }
      }
      if (abortRef.current !== controller) return; // superseded by a new conversation
      if (!stripReasoning(content)) working = working.filter((m) => m.id !== reply.id);
      setMessages(working);
      setIsStreaming(false);
      abortRef.current = null;
      persist(working);
    },
    [persist],
  );

  const send = useCallback(
    (text: string, ctx: ChatContext) => {
      const trimmed = text.trim();
      if (!trimmed || abortRef.current) return;
      setErrorMessage(null);
      const next: ChatMessage[] = [
        ...messagesRef.current,
        { id: uuid(), role: "user", content: trimmed, createdAt: Date.now() },
      ];
      setMessages(next);
      void runCompletion(next, ctx);
    },
    [runCompletion],
  );

  const newConversation = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsStreaming(false);
    setErrorMessage(null);
    setMessages([]);
    messagesRef.current = [];
    setCurrentId(null);
    currentIdRef.current = null;
  }, []);

  /** Starts a fresh conversation seeded with a prompt (used by Today quick actions). */
  const startConversation = useCallback(
    (prompt: string, ctx: ChatContext) => {
      newConversation();
      send(prompt, ctx);
    },
    [newConversation, send],
  );

  const retry = useCallback(
    (ctx: ChatContext) => {
      if (abortRef.current) return;
      let base = messagesRef.current;
      const last = base[base.length - 1];
      if (last?.role === "assistant" && !stripReasoning(last.content)) base = base.slice(0, -1);
      if (base[base.length - 1]?.role !== "user") return;
      setErrorMessage(null);
      void runCompletion(base, ctx);
    },
    [runCompletion],
  );

  const stop = useCallback(() => abortRef.current?.abort(), []);

  const open = useCallback(
    (conversation: Conversation) => {
      newConversation();
      setCurrentId(conversation.id);
      currentIdRef.current = conversation.id;
      setMessages(conversation.messages);
    },
    [newConversation],
  );

  const remove = useCallback(
    (conversation: Conversation) => {
      setConversations((prev) => prev.filter((c) => c.id !== conversation.id));
      if (currentIdRef.current === conversation.id) newConversation();
    },
    [newConversation],
  );

  const deleteAll = useCallback(() => {
    newConversation();
    setConversations([]);
  }, [newConversation]);

  return {
    conversations,
    messages,
    isStreaming,
    currentId,
    errorMessage,
    send,
    startConversation,
    retry,
    stop,
    newConversation,
    open,
    remove,
    deleteAll,
  };
});
