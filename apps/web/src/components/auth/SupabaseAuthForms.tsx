"use client";

import "@/lib/crypto-random-uuid-polyfill";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

import { authClient } from "@/lib/auth/client";
import { getPublicBaseUrl } from "@/lib/public-base-url";
import PasswordField from "@/components/auth/PasswordField";

const inputCls = "ui-control ui-auth-control pl-3.5 pr-12";

type PasswordAuthClient = {
  requestPasswordReset: (input: {
    email: string;
    redirectTo: string;
    fetchOptions?: { throw?: boolean };
  }) => Promise<{ error?: { message?: string } } | void>;
  resetPassword: (input: {
    newPassword: string;
    token: string;
  }) => Promise<{ error?: { message?: string } } | void>;
};

function getPasswordAuthClient() {
  return authClient as unknown as PasswordAuthClient;
}

export function ForgotPasswordCardForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const cleanEmail = email.trim();

    if (!cleanEmail) {
      setError("Ingresa tu correo.");
      return;
    }

    setPending(true);
    setError("");
    try {
      const result = await getPasswordAuthClient().requestPasswordReset({
        email: cleanEmail,
        redirectTo: `${getPublicBaseUrl()}/auth/callback?next=${encodeURIComponent("/auth/reset-password")}`,
        fetchOptions: { throw: true },
      });
      if (result?.error) {
        setError(result.error.message ?? "No fue posible enviar el enlace.");
      } else {
        setSuccess(true);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error inesperado. Intenta de nuevo.",
      );
    } finally {
      setPending(false);
    }
  }

  if (success) {
    return (
      <div className="ui-note ui-note--success text-sm">
        Si existe una cuenta, te enviaremos un enlace para restablecer la contraseña.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="ui-auth-form">
      {error && (
        <div className="ui-note ui-note--danger text-sm">
          {error}
        </div>
      )}

      <label className="ui-auth-form-label">
        Email
        <input
          name="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="nombre@unidep.edu.mx"
          autoComplete="email"
          className="ui-control ui-auth-control"
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="ui-button-primary w-full justify-center"
      >
        {pending ? "Enviando..." : "Enviar enlace"}
      </button>
    </form>
  );
}

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const password = String(fd.get("password") ?? "").trim();
    const confirm = String(fd.get("confirm") ?? "").trim();

    if (!password) {
      setError("Ingresa tu nueva contraseña.");
      return;
    }
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setPending(true);
    setError("");
    try {
      const result = await getPasswordAuthClient().resetPassword({
        newPassword: password,
        token,
      });
      if (result?.error) {
        setError(result.error.message ?? "No fue posible restablecer la contraseña.");
      } else {
        setSuccess(true);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error inesperado. Intenta de nuevo.",
      );
    } finally {
      setPending(false);
    }
  }

  if (success) {
    return (
      <div className="grid gap-4">
        <div className="ui-note ui-note--success text-sm">
          ¡Contraseña actualizada! Ya puedes iniciar sesión con tu nueva contraseña.
        </div>
        <a
          href="/auth/sign-in"
          className="ui-button-primary w-full justify-center"
        >
          Ir a Iniciar sesión
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="ui-auth-form">
      {error && (
        <div className="ui-note ui-note--danger text-sm">
          {error}
        </div>
      )}

      <label className="ui-auth-form-label">
        Nueva contraseña
        <PasswordField
          name="password"
          placeholder="Nueva contraseña"
          autoComplete="new-password"
          className={inputCls}
        />
      </label>

      <label className="ui-auth-form-label">
        Confirmar contraseña
        <PasswordField
          name="confirm"
          placeholder="Repite tu contraseña"
          autoComplete="new-password"
          className={inputCls}
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="ui-button-primary w-full justify-center"
      >
        {pending ? "Guardando…" : "Restablecer contraseña"}
      </button>
    </form>
  );
}

export function ResetPasswordCardForm() {
  return (
    <Suspense fallback={<div className="ui-auth-inline-note">Cargando…</div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
