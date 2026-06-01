"use client";

import { useEffect, useState } from "react";

import { subscribeToPrivateBroadcast } from "@/lib/supabase/client";

type UseRealtimeMessagesOptions = {
  fetchUrl: string | null;
  topic: string | null;
  refreshIntervalMs?: number;
};

export function useRealtimeMessages<TMessage>({
  fetchUrl,
  topic,
  refreshIntervalMs,
}: UseRealtimeMessagesOptions) {
  const [messages, setMessages] = useState<TMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadMessages(options: { silent?: boolean } = {}) {
      if (!fetchUrl) {
        setMessages([]);
        setError(null);
        setIsLoading(false);
        return;
      }

      if (!options.silent) {
        setMessages([]);
        setIsLoading(true);
      }
      setError(null);

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
    const intervalId =
      fetchUrl && refreshIntervalMs
        ? window.setInterval(() => {
            if (document.visibilityState === "visible") {
              void loadMessages({ silent: true });
            }
          }, refreshIntervalMs)
        : null;

    return () => {
      cancelled = true;
      if (intervalId) {
        window.clearInterval(intervalId);
      }
    };
  }, [fetchUrl, refreshIntervalMs]);

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
