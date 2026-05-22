"use client";

import "@/lib/crypto-random-uuid-polyfill";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ForgotPasswordForm,
  NeonAuthUIProvider,
} from "@neondatabase/auth/react/ui";

import { authClient } from "@/lib/auth/client";
import { getPublicBaseUrl } from "@/lib/public-base-url";
import PasswordField from "@/components/auth/PasswordField";

const formClassNames = {
  base: "ui-auth-form",
  label: "ui-auth-form-label",
  input: "ui-control ui-auth-control",
  error: "ui-auth-inline-error",
  button: "ui-button-primary w-full justify-center",
  primaryButton: "",
};

const inputCls = "ui-control ui-auth-control pl-3.5 pr-12";

const forgotPasswordLocalization = {
  EMAIL: "Email",
  EMAIL_PLACEHOLDER: "nombre@unidep.edu.mx",
  IS_INVALID: "es inválido",
  IS_REQUIRED: "es requerido",
  FORGOT_PASSWORD_ACTION: "Enviar enlace",
  FORGOT_PASSWORD_EMAIL:
    "Si existe una cuenta, te enviaremos un enlace para restablecer la contraseña.",
} as const;

export function ForgotPasswordCardForm() {
  const typedAuthClient = authClient as unknown as never;

  return (
    <NeonAuthUIProvider
      authClient={typedAuthClient}
      basePath="/auth"
      baseURL={getPublicBaseUrl()}
      viewPaths={{
        SIGN_IN: "sign-in",
        FORGOT_PASSWORD: "forgot-password",
        RESET_PASSWORD: "reset-password",
      }}
      credentials={{ confirmPassword: true, forgotPassword: true }}
      localizeErrors={false}
    >
      <ForgotPasswordForm
        localization={forgotPasswordLocalization}
        classNames={formClassNames}
      />
    </NeonAuthUIProvider>
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = authClient as unknown as any;
      const result = await client.resetPassword({ newPassword: password, token });
      if (result?.error) {
        setError(result.error.message ?? "No fue posible restablecer la contraseña.");
      } else {
        setSuccess(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado. Intenta de nuevo.");
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
