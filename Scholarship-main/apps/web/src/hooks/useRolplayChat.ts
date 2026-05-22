"use client";

import { useCallback } from "react";

import { useRealtimeMessages } from "@/hooks/useRealtimeMessages";
import { realtimeTopics } from "@/lib/realtime-topics";

export type RolplayMessage = {
  id: string;
  roomId: string;
  chatId: string | null;
  content: string;
  createdAt: string;
  sender: {
    userId: string;
    displayName: string;
    alias: string | null;
    isAnonymous: boolean;
  };
};

export function useRolplayChat(chatId: string) {
  const { messages, isLoading, error, setMessages } = useRealtimeMessages<RolplayMessage>({
    fetchUrl: chatId ? `/api/capacitacion/chats/${chatId}/messages` : null,
    topic: chatId ? realtimeTopics.trainingChatMessages(chatId) : null,
  });

  const addMessage = useCallback(
    async (content: string) => {
      if (!chatId) {
        return false;
      }

      try {
        const response = await fetch(`/api/capacitacion/chats/${chatId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        });

        if (!response.ok) {
          throw new Error("No se pudo enviar el mensaje.");
        }

        const payload = (await response.json()) as { message: RolplayMessage };
        setMessages((current) => {
          if (current.some((message) => message.id === payload.message.id)) {
            return current;
          }
          return [...current, payload.message];
        });
        return true;
      } catch {
        return false;
      }
    },
    [chatId, setMessages],
  );

  return {
    messages,
    isLoading,
    error,
    addMessage,
  };
}
