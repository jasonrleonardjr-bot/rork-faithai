import { useCallback } from "react";
import { useNavigate } from "react-router-dom";

import type { ChatContext } from "@/state/chat";
import { useChat } from "@/state/chat";
import { useSettings } from "@/state/settings";

/** Snapshot of the model config + system prompt for a chat request. */
export function useChatContext(): () => ChatContext {
  const { requestConfig, systemPrompt } = useSettings();
  return useCallback(() => ({ config: requestConfig, systemPrompt: systemPrompt() }), [requestConfig, systemPrompt]);
}

/** Starts a fresh conversation with a prompt and jumps to the Companion tab. */
export function useStartConversation(): (prompt: string) => void {
  const { startConversation } = useChat();
  const context = useChatContext();
  const navigate = useNavigate();
  return useCallback(
    (prompt: string) => {
      startConversation(prompt, context());
      navigate("/companion");
    },
    [startConversation, context, navigate],
  );
}
