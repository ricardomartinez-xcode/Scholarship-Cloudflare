"use client";

import { useMemo, useState } from "react";

import { authClient } from "@/lib/auth/client";

type AuthResult = { error?: { message?: string } | null; data?: unknown; url?: string; redirectUrl?: string } | void;
type AuthClientAny = typeof authClient & Record<string, any>;

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

function emailFrom(value: string) {
  return value.trim().toLowerCase();
}

export default function NeonUserAuthMethods({ callbackURL = "/unidep", defaultEmail = "" }: { callbackURL?: string; defaultEmail?: string }) {
  const [magicEmail, setMagicEmail] = useState(defaultEmail);
  const [otpEmail, setOtpEmail] = useState(defaultEmail);
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const redirect = useMemo(() => safeCallback(callbackURL), [callbackURL]);

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
      const client = authClient as AuthClientAny;
      const result = await client.signIn.magicLink({
        email,
        callbackURL: redirect,
        newUserCallbackURL: `${redirect}${redirect.includes("?") ? "&" : "?"}newUser=1`,
        errorCallbackURL: `/auth/sign-in?error=${encodeURIComponent("No se pudo validar el enlace mágico.")}`,
        metadata: { source: "recalc-sign-in" },
      });
      assertNoAuthError(result, "No se pudo enviar el enlace mágico.");
      setNotice("Te enviamos un enlace mágico. Revisa tu correo para entrar sin contraseña.");
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
      const client = authClient as AuthClientAny;
      const result = await client.emailOtp.sendVerificationOtp({ email, type: "sign-in" });
      assertNoAuthError(result, "No se pudo enviar el código OTP.");
      setOtpSent(true);
      setNotice("Te enviamos un código OTP. Escríbelo para iniciar sesión.");
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
      const client = authClient as AuthClientAny;
      const result = await client.signIn.emailOtp({ email, otp: code });
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
        <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Acceso sin contraseña</div>
        <p className="mt-1 text-xs leading-5 text-slate-300">Usa magic link u OTP si no quieres usar contraseña. También funciona para usuarios invitados.</p>
      </div>

      {notice ? <div className="ui-note ui-note--success text-sm">{notice}</div> : null}
      {error ? <div className="ui-note ui-note--danger text-sm">{error}</div> : null}

      <div className="grid gap-2">
        <label className="ui-auth-form-label">
          Magic link por correo
          <input className="ui-control ui-auth-control" type="email" value={magicEmail} onChange={(event) => setMagicEmail(event.target.value)} placeholder="nombre@unidep.edu.mx" autoComplete="email" />
        </label>
        <button type="button" className="ui-auth-social-button justify-center" onClick={() => void sendMagicLink()} disabled={Boolean(pending)}>
          {pending === "magic" ? "Enviando enlace..." : "Enviar magic link"}
        </button>
      </div>

      <div className="ui-auth-divider">o código OTP</div>

      <div className="grid gap-2">
        <label className="ui-auth-form-label">
          Correo para OTP
          <input className="ui-control ui-auth-control" type="email" value={otpEmail} onChange={(event) => setOtpEmail(event.target.value)} placeholder="nombre@unidep.edu.mx" autoComplete="email" />
        </label>
        <button type="button" className="ui-auth-social-button justify-center" onClick={() => void sendEmailOtp()} disabled={Boolean(pending)}>
          {pending === "otp-send" ? "Enviando código..." : "Enviar código OTP"}
        </button>
        {otpSent ? (
          <div className="grid gap-2">
            <label className="ui-auth-form-label">
              Código recibido
              <input className="ui-control ui-auth-control" inputMode="numeric" value={otp} onChange={(event) => setOtp(event.target.value)} placeholder="123456" autoComplete="one-time-code" />
            </label>
            <button type="button" className="ui-button-primary w-full justify-center" onClick={() => void verifyEmailOtp()} disabled={Boolean(pending)}>
              {pending === "otp-verify" ? "Validando..." : "Entrar con OTP"}
            </button>
          </div>
        ) : null}
      </div>

      <div className="rounded-xl border border-slate-700/70 bg-slate-950/40 p-3 text-xs leading-5 text-slate-300">
        <strong className="text-slate-100">Invitaciones de organización:</strong> abre el enlace de invitación recibido por correo. Si te pide iniciar sesión, puedes usar Google, magic link u OTP con el mismo correo invitado.
      </div>
    </section>
  );
}
