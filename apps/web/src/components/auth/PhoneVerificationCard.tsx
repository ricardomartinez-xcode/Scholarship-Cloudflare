"use client";

import { useState } from "react";

import { authClient } from "@/lib/auth/client";

type AuthResult = { error?: { message?: string } | null } | void;
type AuthClientWithPhoneNumber = typeof authClient & {
  phoneNumber: {
    sendOtp(input: { phoneNumber: string }): Promise<AuthResult>;
    verify(input: {
      phoneNumber: string;
      code: string;
      updatePhoneNumber: boolean;
    }): Promise<AuthResult>;
  };
};

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

export default function PhoneVerificationCard() {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function sendCode() {
    const cleanPhone = phoneNumber.trim();
    if (!cleanPhone.startsWith("+")) {
      setError("Usa formato internacional, por ejemplo +521XXXXXXXXXX.");
      return;
    }

    setPending("send");
    setError(null);
    setNotice(null);
    try {
      const client = authClient as AuthClientWithPhoneNumber;
      const result = await client.phoneNumber.sendOtp({ phoneNumber: cleanPhone });
      assertNoAuthError(result, "No se pudo enviar el código al teléfono.");
      setSent(true);
      setNotice("Código enviado. Escríbelo para verificar tu teléfono.");
    } catch (err) {
      setError(getErrorMessage(err, "No se pudo enviar el código al teléfono."));
    } finally {
      setPending(null);
    }
  }

  async function verifyCode() {
    const cleanPhone = phoneNumber.trim();
    const cleanCode = code.trim();
    if (!cleanPhone || !cleanCode) {
      setError("Completa teléfono y código.");
      return;
    }

    setPending("verify");
    setError(null);
    setNotice(null);
    try {
      const client = authClient as AuthClientWithPhoneNumber;
      const result = await client.phoneNumber.verify({
        phoneNumber: cleanPhone,
        code: cleanCode,
        updatePhoneNumber: true,
      });
      assertNoAuthError(result, "No se pudo verificar el teléfono.");
      setNotice("Teléfono verificado y guardado en tu cuenta.");
      setSent(false);
      setCode("");
    } catch (err) {
      setError(getErrorMessage(err, "Código inválido o expirado."));
    } finally {
      setPending(null);
    }
  }

  return (
    <section className="ui-card ui-card-pad min-w-0 self-start">
      <div className="ui-kicker">Seguridad</div>
      <h2 className="mt-2 text-lg font-semibold text-[color:var(--ui-text-primary)]">Verificación de teléfono</h2>
      <p className="mt-2 text-sm leading-6 text-[color:var(--ui-text-secondary)]">Agrega un teléfono verificado usando OTP de Supabase Auth.</p>

      {notice ? <div className="ui-note ui-note--success mt-4 text-sm">{notice}</div> : null}
      {error ? <div className="ui-note ui-note--danger mt-4 text-sm">{error}</div> : null}

      <div className="mt-6 grid gap-4">
        <label className="grid gap-2 text-sm font-semibold text-[color:var(--ui-text-primary)]">
          Teléfono
          <input className="ui-control" value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} placeholder="+521XXXXXXXXXX" inputMode="tel" autoComplete="tel" />
        </label>
        <button type="button" className="ui-button-secondary w-full" onClick={() => void sendCode()} disabled={Boolean(pending)}>
          {pending === "send" ? "Enviando..." : "Enviar código SMS"}
        </button>

        {sent ? (
          <>
            <label className="grid gap-2 text-sm font-semibold text-[color:var(--ui-text-primary)]">
              Código OTP
              <input className="ui-control" value={code} onChange={(event) => setCode(event.target.value)} placeholder="123456" inputMode="numeric" autoComplete="one-time-code" />
            </label>
            <button type="button" className="ui-button-primary w-full" onClick={() => void verifyCode()} disabled={Boolean(pending)}>
              {pending === "verify" ? "Verificando..." : "Verificar teléfono"}
            </button>
          </>
        ) : null}
      </div>
    </section>
  );
}
