"use client";

import Link from "next/link";
import GoogleSignInButton from "@/components/auth/GoogleSignInButton";
import PasswordField from "@/components/auth/PasswordField";

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
}: AuthMethodSwitcherProps) {
  const isSignUp = mode === "sign-up";
  const passwordSubmitLabel = isSignUp ? "Crear cuenta" : "Iniciar sesión";
  const passworPlaceholder = isSignUp ? "Crea una contraseña" : "Tu contraseña";
  const googleFlag = process.env.NEXT_PUBLIC_SUPABASE_GOOGLE_ENABLED?.toLowerCase();
  const googleEnabled = googleFlag === "1" || googleFlag === "true";

  return (
    <section className="ui-auth-method-panel">
      {googleEnabled ? <GoogleSignInButton callbackURL={callbackURL} /> : null}

      <form
        action={isSignUp ? "/api/auth/sign-up" : "/api/auth/sign-in"}
        method="post"
        className="ui-auth-form"
      >
        {isSignUp && token ? <input type="hidden" name="token" value={token} /> : null}
        {isSignUp ? <input type="hidden" name="callbackURL" value={callbackURL} /> : null}
        {isSignUp ? <input type="hidden" name="next" value={next} /> : null}
        {isSignUp && fromInvite ? <input type="hidden" name="fromInvite" value="1" /> : null}

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
            required
          />
        </label>

        {!isSignUp ? (
          <div className="ui-auth-helper-row">
            <Link
              href={
                defaultEmail
                  ? `/iuth/forgot-password?email=${encodeURIComponent(defaultEmail)}`
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
