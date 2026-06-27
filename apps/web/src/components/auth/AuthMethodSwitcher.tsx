"use client";

import Link from "next/link";
import { useState } from "react";

import GoogleSignInButton from "@/components/auth/GoogleSignInButton";
import NeonUserAuthMethods from "@/components/auth/NeonUserAuthMethods";
import PasswordField from "@/components/auth/PasswordField";
import { isCloudflareRuntime } from "@/lib/cloudflare/runtime";

type AuthMethod = "passwordless" | "password";
type AuthMode = "sign-in" | "sign-up";

type AuthMethodSwitcherProps = {
  mode: AuthMode;
  callbackURL: string;
  defaultEmail?: string;
  lockedEmail?: boolean;
  next?: string;
  fromInvite?: boolean;
  token?: string;
  initialMethod?: AuthMethod;
};

export default function AuthMethodSwitcher({
  mode,
  callbackURL,
  defaultEmail = "",
  lockedEmail = false,
  next = "",
  fromInvite = false,
  token = "",
  initialMethod = "passwordless",
}: AuthMethodSwitcherProps) {
  const cloudflareRuntime = isCloudflareRuntime();
  const [method, setMethod] = useState<AuthMethod>(
    cloudflareRuntime ? "password" : initialMethod,
  );
  const isSignUp = mode === "sign-up";
  const passwordLabel = isSignUp ? "Crear contraseña" : "Contraseña";
  const passwordSubmitLabel = isSignUp ? "Crear cuenta" : "Iniciar sesión";
  const passwordPlaceholder = isSignUp ? "Crea una contraseña" : "Tu contraseña";

  return (
    <section className="ui-auth-method-panel">
      {!cloudflareRuntime ? <GoogleSignInButton callbackURL={callbackURL} /> : null}

      {!cloudflareRuntime ? (
        <div className="ui-auth-segmented" role="tablist" aria-label="Método de acceso">
          <button
            type="button"
            className="ui-auth-segment"
            aria-pressed={method === "passwordless"}
            onClick={() => setMethod("passwordless")}
          >
            Sin contraseña
          </button>
          <button
            type="button"
            className="ui-auth-segment"
            aria-pressed={method === "password"}
            onClick={() => setMethod("password")}
          >
            {passwordLabel}
          </button>
        </div>
      ) : null}

      <div role={cloudflareRuntime ? undefined : "tabpanel"}>
        {!cloudflareRuntime && method === "passwordless" ? (
          <NeonUserAuthMethods
            callbackURL={callbackURL}
            defaultEmail={defaultEmail}
            lockedEmail={lockedEmail}
            mode={mode}
          />
        ) : (
          <form
            action={isSignUp ? "/api/auth/sign-up" : "/api/auth/sign-in"}
            method="post"
            className="ui-auth-form"
          >
            {isSignUp && token ? <input type="hidden" name="token" value={token} /> : null}
            {isSignUp ? <input type="hidden" name="callbackURL" value={callbackURL} /> : null}
            {!isSignUp ? <input type="hidden" name="next" value={next} /> : null}
            {!isSignUp && fromInvite ? <input type="hidden" name="fromInvite" value="1" /> : null}

            <label className="ui-auth-form-label">
              Correo
              <input
                name="email"
                type="email"
                placeholder="nombre@unidep.edu.mx"
                defaultValue={defaultEmail}
                readOnly={lockedEmail}
                autoComplete="username"
                required
                className="ui-control ui-auth-control read-only:cursor-not-allowed read-only:opacity-70"
              />
            </label>

            <label className="ui-auth-form-label">
              Contraseña
              <PasswordField
                name="password"
                placeholder={passwordPlaceholder}
                autoComplete={isSignUp ? "new-password" : "current-password"}
                className="ui-control ui-auth-control pl-3.5 pr-12"
                minLength={isSignUp && cloudflareRuntime ? 12 : undefined}
                maxLength={isSignUp && cloudflareRuntime ? 128 : undefined}
                required
              />
            </label>

            {isSignUp && cloudflareRuntime ? (
              <p className="text-xs text-slate-400">
                Usa una contraseña de al menos 12 caracteres.
              </p>
            ) : null}

            {!isSignUp ? (
              cloudflareRuntime ? (
                <p className="text-xs text-slate-400">
                  ¿Problemas de acceso? Contacta al administrador de tu organización.
                </p>
              ) : (
                <div className="ui-auth-helper-row">
                  <Link
                    href={
                      defaultEmail
                        ? `/auth/forgot-password?email=${encodeURIComponent(defaultEmail)}`
                        : "/auth/forgot-password"
                    }
                    className="ui-auth-link text-sm"
                  >
                    ¿Olvidaste tu contraseña?
                  </Link>
                </div>
              )
            ) : null}

            <button type="submit" className="ui-button-primary w-full justify-center">
              {passwordSubmitLabel}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
