"use client";

import { useMemo, useState } from "react";

import { authClient } from "@/lib/auth/client";

type AuthResult = { error?: { message?: string } | null; data?: unknown; url?: string; redirectUrl?: string } | void;
type AuthClientWithPasswordless = typeof authClient & {
  signIn: typeof authClient.signIn & {
    magicLink(input: {
      email: string;
      callbackURL: string;
      newUserCallbackURL: string;
      errorCallbackURL: string;
    }): Promise<AuthResult>;
    emailOtp(input: {
      email: string;
      otp: string;
      name?: string;
    }): Promise<AuthResult>;
  };
  emailOtp: {
    sendVerificationOtp(input: {
      email: string;
      type: "sign-in";
    }): Promise<AuthResult>;
  };
};

type AuthMethodsMode = "sign-in" | "sign-up";
type PasswordlessMethod = "magic" | "otp";

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "object" && error && "message" in error && typeof (error as { message?: unknown }).message === "string") {
    return (error as { message: string }).message;
  }
  return fallback;
}

function assertNoAuthError(result: AuthResult, fallback: string) {
  const error = result && typeof result === "object" ? result.error : null;
  if (error?.message) throw new Error(error.message);
  if (error) throw new Error(fallback);
}

function safeNextPath(callbackURL: string) {
  const fallback = "/unidep";
  const raw = callbackURL.trim() || fallback;

  try {
    const parsed = new URL(raw, typeof window === "undefined" ? "https://recalc.relead.com.mx" : window.location.origin);
    const path = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    if (!path.startsWith("/") || path.startsWith("//") || path.startsWith("/auth/after-login")) return fallback;
    return path;
  } catch {
    return fallback;
  }
}

function absoluteUrl(path: string) {
  if (typeof window === "undefined") return path;
  return new URL(path, window.location.origin).toString();
}

function addQuery(path: string, params: Record<string, string>) {
  const url = new URL(path, typeof window === "undefined" ? "https://recalc.relead.com.mx" : window.location.origin);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return `${url.pathname}${url.search}${url.hash}`;
}

function buildAuthCallback(nextPath: string, extra: Record<string, string> = {}) {
  return absoluteUrl(addQuery("/auth/callback", { next: nextPath, ...extra }));
}

function buildAuthErrorCallback(mode: AuthMethodsMode, nextPath: string, message: string) {
  return absoluteUrl(
    addQuery(`/auth/${mode === "sign-up" ? "sign-up" : "sign-in"}`, {
      error: message,
      next: nextPath,
    }),
  );
}

function emailFrom(value: string) {
  return value.trim().toLowerCase();
}

function displayNameFromEmail(email: string) {
  const local = email.split("@")[0] ?? "Usuario";
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ") || "Usuario";
}

function modeCopy(mode: AuthMethodsMode) {
  if (mode === "sign-up") {
    return {
      eyebrow: "Crear cuenta sin contraseña",
      description: "Puedes crear o activar tu cuenta con un enlace mágico u OTP. Si vienes por invitación, usa el mismo correo invitado.",
      magicLabel: "Crear o entrar con magic link",
      magicPending: "Enviando enlace...",
      magicSuccess: "Te enviamos un enlace mágico. Ábrelo para crear o activar tu cuenta.",
      otpSendLabel: "Enviar código OTP",
      otpSuccess: "Te enviamos un código OTP. Escríbelo para crear o activar tu cuenta.",
      otpVerifyLabel: "Crear o entrar con OTP",
    };
  }

  return {
    eyebrow: "Acceso sin contraseña",
    description: "Usa magic link u OTP si no quieres usar contraseña. También funciona para usuarios invitados.",
    magicLabel: "Enviar magic link",
    magicPending: "Enviando enlace...",
    magicSuccess: "Te enviamos un enlace mágico. Revisa tu correo para entrar sin contraseña.",
    otpSendLabel: "Enviar código OTP",
    otpSuccess: "Te enviamos un código OTP. Escríbelo para iniciar sesión.",
    otpVerifyLabel: "Entrar con OTP",
  };
}

export default function SupabaseUserAuthMethods({
  callbackURL = "/unidep",
  defaultEmail = "",
  mode = "sign-in",
  lockedEmail = false,
}: {
  callbackURL?: string;
  defaultEmail?: string;
  mode?: AuthMethodsMode;
  lockedEmail?: boolean;
}) {
  const [method, setMethod] = useState<PasswordlessMethod>("magic");
  const [email, setEmail] = useState(defaultEmail);
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const nextPath = useMemo(() => safeNextPath(callbackURL), [callbackURL]);
  const copy = modeCopy(mode);

  function handleEmailChange(value: string) {
    setEmail(value);
    setOtp("");
    setOtpSent(false);
  }

  function selectMethod(nextMethod: PasswordlessMethod) {
    setMethod(nextMethod);
    setError(null);
    setNotice(null);
  }

  async function sendMagicLink() {
    const cleanEmail = emailFrom(email);
    if (!cleanEmail) {
      setError("Ingresa tu correo para enviarte el enlace mágico.");
      return;
    }

    setPending("magic");
    setError(null);
    setNotice(null);
    try {
      const client = authClient as AuthClientWithPasswordless;
      const result = await client.signIn.magicLink({
        email: cleanEmail,
        callbackURL: buildAuthCallback(nextPath),
        newUserCallbackURL: buildAuthCallback(nextPath, { newUser: "1" }),
        errorCallbackURL: buildAuthErrorCallback(mode, nextPath, "No se pudo validar el enlace mágico."),
      });
      assertNoAuthError(result, "No se pudo enviar el enlace mágico.");
      setNotice(copy.magicSuccess);
    } catch (err) {
      setError(getErrorMessage(err, "No se pudo enviar el enlace mágico."));
    } finally {
      setPending(null);
    }
  }

  async function sendEmailOtp() {
    const cleanEmail = emailFrom(email);
    if (!cleanEmail) {
      setError("Ingresa tu correo para enviarte el código OTP.");
      return;
    }

    setPending("otp-send");
    setError(null);
    setNotice(null);
    try {
      const client = authClient as AuthClientWithPasswordless;
      const result = await client.emailOtp.sendVerificationOtp({ email: cleanEmail, type: "sign-in" });
      assertNoAuthError(result, "No se pudo enviar el código OTP.");
      setOtpSent(true);
      setNotice(copy.otpSuccess);
    } catch (err) {
      setError(getErrorMessage(err, "No se pudo enviar el código OTP."));
    } finally {
      setPending(null);
    }
  }

  async function verifyEmailOtp() {
    const cleanEmail = emailFrom(email);
    const code = otp.trim();
    if (!cleanEmail || !code) {
      setError("Completa correo y código OTP.");
      return;
    }

    setPending("otp-verify");
    setError(null);
    setNotice(null);
    try {
      const client = authClient as AuthClientWithPasswordless;
      const result = await client.signIn.emailOtp({
        email: cleanEmail,
        otp: code,
        ...(mode === "sign-up" ? { name: displayNameFromEmail(cleanEmail) } : {}),
      });
      assertNoAuthError(result, "No se pudo validar el código OTP.");
      window.location.assign(addQuery("/auth/after-login", { next: nextPath, ...(mode === "sign-up" ? { newUser: "1" } : {}) }));
    } catch (err) {
      setError(getErrorMessage(err, "Código inválido o expirado."));
    } finally {
      setPending(null);
    }
  }

  return (
    <section className="grid gap-3">
      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">{copy.eyebrow}</div>
        <p className="mt-1 text-xs leading-5 text-slate-300">{copy.description}</p>
      </div>

      {notice ? <div className="ui-note ui-note--success text-sm">{notice}</div> : null}
      {error ? <div className="ui-note ui-note--danger text-sm">{error}</div> : null}

      <div className="ui-auth-segmented" role="tablist" aria-label="Método sin contraseña">
        <button
          type="button"
          className="ui-auth-segment"
          aria-pressed={method === "magic"}
          onClick={() => selectMethod("magic")}
        >
          Magic link
        </button>
        <button
          type="button"
          className="ui-auth-segment"
          aria-pressed={method === "otp"}
          onClick={() => selectMethod("otp")}
        >
          OTP
        </button>
      </div>

      <div className="grid gap-2">
        <label className="ui-auth-form-label">
          Correo
          <input
            className="ui-control ui-auth-control read-only:cursor-not-allowed read-only:opacity-70"
            type="email"
            value={email}
            onChange={(event) => handleEmailChange(event.target.value)}
            placeholder="nombre@unidep.edu.mx"
            autoComplete="email"
            readOnly={lockedEmail}
          />
        </label>

        {method === "magic" ? (
          <button type="button" className="ui-auth-social-button justify-center" onClick={() => void sendMagicLink()} disabled={Boolean(pending)}>
            {pending === "magic" ? copy.magicPending : copy.magicLabel}
          </button>
        ) : (
          <div className="grid gap-2">
            <button type="button" className="ui-auth-social-button justify-center" onClick={() => void sendEmailOtp()} disabled={Boolean(pending)}>
              {pending === "otp-send" ? "Enviando código..." : copy.otpSendLabel}
            </button>
            <label className="ui-auth-form-label">
              Código recibido
              <input
                className="ui-control ui-auth-control"
                inputMode="numeric"
                value={otp}
                onChange={(event) => setOtp(event.target.value)}
                placeholder="123456"
                autoComplete="one-time-code"
                disabled={!otpSent}
              />
            </label>
            <button type="button" className="ui-button-primary w-full justify-center" onClick={() => void verifyEmailOtp()} disabled={Boolean(pending) || !otpSent}>
              {pending === "otp-verify" ? "Validando..." : copy.otpVerifyLabel}
            </button>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-[color:var(--ui-border)] bg-white p-3 text-xs leading-5 text-[color:var(--ui-text-secondary)]">
        <strong className="text-[color:var(--ui-text-primary)]">Invitaciones de organización:</strong> abre el enlace de invitación recibido por correo. Si te pide iniciar sesión o crear cuenta, usa Google, magic link u OTP con el mismo correo invitado.
      </div>
    </section>
  );
}
