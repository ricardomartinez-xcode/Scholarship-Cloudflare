"use client";

import Link from "next/link";

import OAuthProviderButtons from "@/components/auth/OAuthProviderButtons";
import PasswordField from "@/components/auth/PasswordField";
import type { OAuthProviderOption } from "@/lib/neon-auth-oauth";

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
  oauthProviders?: OAuthProviderOption[];
};

export default function AuthMethodSwitcher({
  mode,
  callbackURL,
  defaultEmail = "",
  lockedEmail = false,
  next = "",
  fromInvite = false,
  token = "",
  oauthProviders = [],
}: AuthMethodSwitcherProps) {
  const isSignUp = mode === "sign-up";
  const passwordSubmitLabel = isSignUp ? "Crear cuenta" : "Iniciar sesión";
  const passwordPlaceholder = isSignUp ? "Crea una contraseña" : "Tu contraseña";

  return (
    <section className="ui-auth-method-panel">
      {oauthProviders.length ? (
        <>
          <OAuthProviderButtons mode={mode} callbackURL={callbackURL} providers={oauthProviders} token={token} />
          <div className="ui-auth-divider">o usa correo</div>
        </>
      ) : null}

      <form action={isSignUp ? "/api/auth/sign-up" : "/api/auth/sign-in"} method="post" className="ui-auth-form">
        {isSignUp && token ? <input type="hidden" name="token" value={token} /> : null}
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
          />
        </label>

        {!isSignUp ? (
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
        ) : null}

        <button type="submit" className="ui-button-primary w-full justify-center">
          {passwordSubmitLabel}
        </button>
      </form>
    </section>
  );
}
