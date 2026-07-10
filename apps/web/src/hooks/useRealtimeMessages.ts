"use client";

import { useEffect, useRef, useState } from "react";

import { subscribeToPostgresMessages } from "@/lib/supabase/client";

type UseRealtimeMessagesOptions = {
  fetchUrl: string | null;
  topic: string | null;
  privateChannel?: boolean;
  refreshIntervalMs?: number;
};

export function useRealtimeMessages<TMessage>({
  fetchUrl,
  topic,
  privateChannel = true,
  refreshIntervalMs,
}: UseRealtimeMessagesOptions) {
  const [messages, setMessages] = useState<TMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const silentReloadRef = useRef<(() => void) | null>(null);

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
    silentReloadRef.current = () => {
      void loadMessages({ silent: true });
    };
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
      silentReloadRef.current = null;
      if (intervalId) {
        window.clearInterval(intervalId);
      }
    };
  }, [fetchUrl, refreshIntervalMs]);

  useEffect(() => {
    if (!topic) {
      return;
    }

    void privateChannel;
    const unsubscribe = subscribeToPostgresMessages({
      topic,
      onChange: () => {
        silentReloadRef.current?.();
      },
    });

    return () => {
      unsubscribe?.();
    };
  }, [privateChannel, topic]);

  return {
    messages,
    setMessages,
    isLoading,
    error,
  };
}
