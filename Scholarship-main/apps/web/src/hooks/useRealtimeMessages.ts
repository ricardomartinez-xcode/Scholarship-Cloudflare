"use client";

import { useEffect, useState } from "react";

import { subscribeToPrivateBroadcast } from "@/lib/supabase/client";

type UseRealtimeMessagesOptions = {
  fetchUrl: string | null;
  topic: string | null;
};

export function useRealtimeMessages<TMessage>({
  fetchUrl,
  topic,
}: UseRealtimeMessagesOptions) {
  const [messages, setMessages] = useState<TMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadMessages() {
      if (!fetchUrl) {
        setMessages([]);
        setError(null);
        setIsLoading(false);
        return;
      }

      setMessages([]);
      setError(null);
      setIsLoading(true);

      try {
        const response = await fetch(fetchUrl, { cache: "no-store" });
        if (!response.ok) {
          throw new Error("No se pudo cargar el historial.");
        }

        const payload = (await response.json()) as { messages?: TMessage[] };
        if (cancelled) {
          return;
        }

        setMessages(payload.messages ?? []);
      } catch (loadError) {
        if (cancelled) {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "No se pudo cargar el historial.",
        );
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadMessages();

    return () => {
      cancelled = true;
    };
  }, [fetchUrl]);

  useEffect(() => {
    if (!topic) {
      return;
    }

    const unsubscribe = subscribeToPrivateBroadcast<TMessage>({
      topic,
      event: "new_message",
      onMessage: (message) => {
        setMessages((current) => {
          const messageId = (message as { id?: string }).id;
          if (!messageId) {
            return [...current, message];
          }

          if (
            current.some((entry) => (entry as { id?: string }).id === messageId)
          ) {
            return current;
          }

          return [...current, message];
        });
      },
    });

    return () => {
      unsubscribe?.();
    };
  }, [topic]);

  return {
    messages,
    setMessages,
    isLoading,
    error,
  };
}
