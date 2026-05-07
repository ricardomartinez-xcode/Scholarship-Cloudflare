"use client";

import { useEffect, useRef, useState } from "react";

type PreferenceState = Record<string, unknown>;

export function useAdminUiPreferences<TState extends PreferenceState>(
  module: string,
  defaults: TState,
) {
  const [state, setState] = useState<TState>(defaults);
  const [ready, setReady] = useState(false);
  const initializedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch(
          `/api/admin/ui-preferences?module=${encodeURIComponent(module)}`,
          { cache: "no-store" },
        );
        if (!response.ok) throw new Error("load_failed");
        const payload = (await response.json()) as { state?: PreferenceState };
        if (cancelled) return;
        setState({
          ...defaults,
          ...(payload.state ?? {}),
        } as TState);
      } catch {
        if (!cancelled) setState(defaults);
      } finally {
        if (!cancelled) {
          initializedRef.current = true;
          setReady(true);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [defaults, module]);

  useEffect(() => {
    if (!initializedRef.current) return;

    const timeout = window.setTimeout(() => {
      void fetch("/api/admin/ui-preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ module, state }),
      });
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [module, state]);

  return {
    ready,
    state,
    setState,
    patchState: (partial: Partial<TState>) =>
      setState((current) => ({ ...current, ...partial })),
  };
}
