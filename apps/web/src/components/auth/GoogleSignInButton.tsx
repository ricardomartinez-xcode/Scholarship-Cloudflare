"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import { authClient } from "@/lib/auth/client";

type SocialArgs = Parameters<typeof authClient.signIn.social>[0];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getNestedString(source: Record<string, unknown>, key: string) {
  const value = source[key];
  return typeof value === "string" ? value : null;
}

function getRedirectUrl(result: unknown) {
  if (!isRecord(result)) return null;

  const directUrl = getNestedString(result, "url");
  if (directUrl) return directUrl;

  const data = result.data;
  if (!isRecord(data)) return null;

  return getNestedString(data, "url") ?? getNestedString(data, "redirectUrl");
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  if (!isRecord(error)) return "No fue posible iniciar con Google.";

  const directMessage = getNestedString(error, "message");
  if (directMessage) return directMessage;

  const nestedError = error.error;
  if (isRecord(nestedError)) {
    return getNestedString(nestedError, "message") ?? "No fue posible iniciar con Google.";
  }

  return "No fue posible iniciar con Google.";
}

function toAbsoluteUrl(input: string, fallbackPath = "/unidep") {
  const raw = (input || "").trim();
  const safe = raw || fallbackPath;

  if (typeof window === "undefined") return safe;

  try {
    // If already absolute, keep it
    const maybe = new URL(safe);
    return maybe.toString();
  } catch {
    // Make it absolute from current origin
    return new URL(safe.startsWith("/") ? safe : fallbackPath, window.location.origin).toString();
  }
}

function addQuery(absoluteUrl: string, params: Record<string, string>) {
  try {
    const u = new URL(absoluteUrl);
    Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, v));
    return u.toString();
  } catch {
    return absoluteUrl;
  }
}

function toNextPath(absoluteUrl: string) {
  try {
    const u = new URL(absoluteUrl);
    return `${u.pathname}${u.search}`;
  } catch {
    return "/unidep";
  }
}

function buildSupabaseCallback(nextPath: string) {
  const url = new URL("/auth/callback", typeof window === "undefined" ? "https://recalc.relead.com.mx" : window.location.origin);
  url.searchParams.set("next", nextPath);
  return url.toString();
}

export default function GoogleSignInButton({ callbackURL = "/unidep" }: { callbackURL?: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();

  const computed = useMemo(() => {
    const cb = toAbsoluteUrl(callbackURL, "/unidep");
    const nextPath = toNextPath(cb);
    const supabaseCallback = buildSupabaseCallback(nextPath);

    // New users go to /unidep?newUser=1 so you can show the "cambia tu contraseña temporal"
    const newUserCb = addQuery(cb, { newUser: "1" });

    // If something fails, go back to sign-in preserving next
    const signInUrl = `/auth/sign-in?error=${encodeURIComponent(
      "No fue posible iniciar con Google."
    )}&next=${encodeURIComponent(nextPath)}`;
    const errCb = toAbsoluteUrl(signInUrl, "/auth/sign-in");

    return { cb: supabaseCallback, newUserCb, errCb };
  }, [callbackURL]);

  // searchParams consumed to avoid unused-variable lint warning
  void searchParams;

  const handleClick = async () => {
    setError(null);
    setLoading(true);

    try {
      // Some SDK versions auto-redirect; others return a URL.
      // Use the official args shape (callbackURL/newUserCallbackURL/errorCallbackURL).
      const args: SocialArgs = {
        provider: "google",
        callbackURL: computed.cb,
        newUserCallbackURL: computed.newUserCb,
        errorCallbackURL: computed.errCb,
      };

      const result = await authClient.signIn.social(args);
      const maybeUrl = getRedirectUrl(result);

      if (typeof window !== "undefined" && maybeUrl) {
        window.location.assign(maybeUrl);
        return;
      }

      // If SDK already redirected, this code won't run. If it didn't,
      // keep UX clean and stop spinner.
      setLoading(false);
    } catch (error: unknown) {
      setError(getErrorMessage(error));
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="ui-auth-social-button disabled:opacity-60"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
          <path
            fill="#EA4335"
            d="M12 10.2v3.9h5.5c-.2 1.3-1.5 3.8-5.5 3.8A6.1 6.1 0 0 1 12 6a5.5 5.5 0 0 1 3.9 1.5l2.7-2.6A9.7 9.7 0 0 0 12 2.5 9.5 9.5 0 0 0 2.5 12 9.5 9.5 0 0 0 12 21.5c5.5 0 9.2-3.9 9.2-9.4 0-.6-.1-1-.2-1.4H12Z"
          />
        </svg>
        {loading ? "Conectando..." : "Continuar con Google"}
      </button>

      {error ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}
    </div>
  );
}
