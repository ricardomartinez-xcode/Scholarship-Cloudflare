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

function safeCallback(callbackURL: string) {
  return callbackURL.startsWith("/") ? callbackURL : "/unidep";
}

function absoluteUrl(path: string) {
  if (typeof window === "undefined") return path;
  return new URL(path, window.location.origin).toString();
}

function addQuery(path: string, params: Record<string, string>) {
  if (typeof window === "undefined") return path;
  const url = new URL(path, window.location.origin);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return `${url.pathname}${url.search}${url.hash}`;
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

export default function NeonUserAuthMethods({
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
  const [magicEmail, setMagicEmail] = useState(defaultEmail);
  const [otpEmail, setOtpEmail] = useState(defaultEmail);
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const redirect = useMemo(() => safeCallback(callbackURL), [callbackURL]);
  const copy = modeCopy(mode);

  async function sendMagicLink() {
    const email = emailFrom(magicEmail);
    if (!email) {
      setError("Ingresa tu correo para enviarte el enlace mágico.");
      return;
    }

    setPending("magic");
    setError(null);
    setNotice(null);
    try {
      const client = authClient as AuthClientWithPasswordless;
      const result = await client.signIn.magicLink({
        email,
        callbackURL: redirect,
        newUserCallbackURL: addQuery(redirect, { newUser: "1" }),
        errorCallbackURL: `/auth/${mode === "sign-up" ? "sign-up" : "sign-in"}?error=${encodeURIComponent("No se pudo validar el enlace mágico.")}`,
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
    const email = emailFrom(otpEmail);
    if (!email) {
      setError("Ingresa tu correo para enviarte el código OTP.");
      return;
    }

    setPending("otp-send");
    setError(null);
    setNotice(null);
    try {
      const client = authClient as AuthClientWithPasswordless;
      const result = await client.emailOtp.sendVerificationOtp({ email, type: "sign-in" });
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
    const email = emailFrom(otpEmail);
    const code = otp.trim();
    if (!email || !code) {
      setError("Completa correo y código OTP.");
      return;
    }

    setPending("otp-verify");
    setError(null);
    setNotice(null);
    try {
      const client = authClient as AuthClientWithPasswordless;
      const result = await client.signIn.emailOtp({
        email,
        otp: code,
        ...(mode === "sign-up" ? { name: displayNameFromEmail(email) } : {}),
      });
      assertNoAuthError(result, "No se pudo validar el código OTP.");
      window.location.assign(absoluteUrl(redirect));
    } catch (err) {
      setError(getErrorMessage(err, "Código inválido o expirado."));
    } finally {
      setPending(null);
    }
  }

  return (
    <section className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">{copy.eyebrow}</div>
        <p className="mt-1 text-xs leading-5 text-slate-300">{copy.description}</p>
      </div>

      {notice ? <div className="ui-note ui-note--success text-sm">{notice}</div> : null}
      {error ? <div className="ui-note ui-note--danger text-sm">{error}</div> : null}

      <div className="grid gap-2">
        <label className="ui-auth-form-label">
          Magic link por correo
          <input
            className="ui-control ui-auth-control read-only:cursor-not-allowed read-only:opacity-70"
            type="email"
            value={magicEmail}
            onChange={(event) => setMagicEmail(event.target.value)}
            placeholder="nombre@unidep.edu.mx"
            autoComplete="email"
            readOnly={lockedEmail}
          />
        </label>
        <button type="button" className="ui-auth-social-button justify-center" onClick={() => void sendMagicLink()} disabled={Boolean(pending)}>
          {pending === "magic" ? copy.magicPending : copy.magicLabel}
        </button>
      </div>

      <div className="ui-auth-divider">o código OTP</div>

      <div className="grid gap-2">
        <label className="ui-auth-form-label">
          Correo para OTP
          <input
            className="ui-control ui-auth-control read-only:cursor-not-allowed read-only:opacity-70"
            type="email"
            value={otpEmail}
            onChange={(event) => setOtpEmail(event.target.value)}
            placeholder="nombre@unidep.edu.mx"
            autoComplete="email"
            readOnly={lockedEmail}
          />
        </label>
        <button type="button" className="ui-auth-social-button justify-center" onClick={() => void sendEmailOtp()} disabled={Boolean(pending)}>
          {pending === "otp-send" ? "Enviando código..." : copy.otpSendLabel}
        </button>
        {otpSent ? (
          <div className="grid gap-2">
            <label className="ui-auth-form-label">
              Código recibido
              <input className="ui-control ui-auth-control" inputMode="numeric" value={otp} onChange={(event) => setOtp(event.target.value)} placeholder="123456" autoComplete="one-time-code" />
            </label>
            <button type="button" className="ui-button-primary w-full justify-center" onClick={() => void verifyEmailOtp()} disabled={Boolean(pending)}>
              {pending === "otp-verify" ? "Validando..." : copy.otpVerifyLabel}
            </button>
          </div>
        ) : null}
      </div>

      <div className="rounded-xl border border-slate-700/70 bg-slate-950/40 p-3 text-xs leading-5 text-slate-300">
        <strong className="text-slate-100">Invitaciones de organización:</strong> abre el enlace de invitación recibido por correo. Si te pide iniciar sesión o crear cuenta, usa Google, magic link u OTP con el mismo correo invitado.
      </div>
    </section>
  );
}
