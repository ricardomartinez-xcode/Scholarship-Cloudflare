"use client";

import { useMemo, useState } from "react";

import { authClient } from "@/lib/auth/client";
import type { NeonAuthOAuthProvider, OAuthProviderOption } from "@/lib/neon-auth-oauth";

type AuthMode = "sign-in" | "sign-up";
type SocialArgs = Parameters<typeof authClient.signIn.social>[0];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function nestedString(source: Record<string, unknown>, key: string) {
  const value = source[key];
  return typeof value === "string" ? value : null;
}

function redirectUrlFrom(result: unknown) {
  if (!isRecord(result)) return null;

  const url = nestedString(result, "url") ?? nestedString(result, "redirectUrl");
  if (url) return url;

  const data = result.data;
  if (!isRecord(data)) return null;

  return nestedString(data, "url") ?? nestedString(data, "redirectUrl");
}

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (!isRecord(error)) return fallback;

  const direct = nestedString(error, "message");
  if (direct) return direct;

  const nested = error.error;
  if (!isRecord(nested)) return fallback;

  return nestedString(nested, "message") ?? fallback;
}

function toAbsoluteUrl(input: string, fallbackPath = "/unidep") {
  const raw = input.trim() || fallbackPath;
  if (typeof window === "undefined") return raw;

  try {
    return new URL(raw).toString();
  } catch {
    return new URL(raw.startsWith("/") ? raw : fallbackPath, window.location.origin).toString();
  }
}

function addQuery(absoluteUrl: string, params: Record<string, string>) {
  try {
    const url = new URL(absoluteUrl);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    return url.toString();
  } catch {
    return absoluteUrl;
  }
}

function toNextPath(absoluteUrl: string) {
  try {
    const url = new URL(absoluteUrl);
    return `${url.pathname}${url.search}`;
  } catch {
    return "/unidep";
  }
}

function providerMark(provider: NeonAuthOAuthProvider) {
  if (provider === "google") return "G";
  if (provider === "github") return "GH";
  if (provider === "microsoft") return "M";
  return "V";
}

function providerErrorPath({
  mode,
  token,
  nextPath,
  message,
}: {
  mode: AuthMode;
  token?: string;
  nextPath: string;
  message: string;
}) {
  const base = mode === "sign-up" ? "/auth/sign-up" : "/auth/sign-in";
  const params = new URLSearchParams({ error: message });
  if (mode === "sign-up" && token) params.set("token", token);
  if (mode === "sign-in" && nextPath) params.set("next", nextPath);
  return `${base}?${params.toString()}`;
}

export default function OAuthProviderButtons({
  mode,
  callbackURL,
  providers,
  token = "",
}: {
  mode: AuthMode;
  callbackURL: string;
  providers: OAuthProviderOption[];
  token?: string;
}) {
  const [pendingProvider, setPendingProvider] = useState<NeonAuthOAuthProvider | null>(null);
  const [error, setError] = useState<string | null>(null);

  const computed = useMemo(() => {
    const callback = toAbsoluteUrl(callbackURL, "/unidep");
    return {
      callback,
      newUserCallback: addQuery(callback, { newUser: "1" }),
      nextPath: toNextPath(callback),
    };
  }, [callbackURL]);

  if (!providers.length) return null;

  async function signIn(provider: OAuthProviderOption) {
    const fallback = `No fue posible iniciar con ${provider.label}.`;
    setPendingProvider(provider.id);
    setError(null);

    try {
      const args: SocialArgs = {
        provider: provider.id as SocialArgs["provider"],
        callbackURL: computed.callback,
        newUserCallbackURL: computed.newUserCallback,
        errorCallbackURL: toAbsoluteUrl(
          providerErrorPath({
            mode,
            token,
            nextPath: computed.nextPath,
            message: fallback,
          }),
          mode === "sign-up" ? "/auth/sign-up" : "/auth/sign-in",
        ),
      };

      const result = await authClient.signIn.social(args);
      const url = redirectUrlFrom(result);
      if (typeof window !== "undefined" && url) {
        window.location.assign(url);
        return;
      }

      setPendingProvider(null);
    } catch (err) {
      setError(errorMessage(err, fallback));
      setPendingProvider(null);
    }
  }

  return (
    <div className="grid gap-2">
      {providers.map((provider) => (
        <button
          key={provider.id}
          type="button"
          onClick={() => void signIn(provider)}
          disabled={pendingProvider !== null}
          className="ui-auth-social-button disabled:opacity-60"
        >
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 text-[10px] font-bold text-slate-700">
            {providerMark(provider.id)}
          </span>
          {pendingProvider === provider.id ? "Conectando..." : `Continuar con ${provider.label}`}
        </button>
      ))}

      {error ? <div className="ui-note ui-note--danger text-sm">{error}</div> : null}
    </div>
  );
}
