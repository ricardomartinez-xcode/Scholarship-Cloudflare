import Link from "next/link";

import BrandedAuthShell from "@/components/auth/BrandedAuthShell";
import GoogleSignInButton from "@/components/auth/GoogleSignInButton";
import NeonUserAuthMethods from "@/components/auth/NeonUserAuthMethods";
import { getInviteByToken } from "@/lib/invites";
import PasswordField from "@/components/auth/PasswordField";
import { getSystemRoleMeta } from "@/lib/system-roles";

export const dynamic = "force-dynamic";

export default async function SignUpPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string; success?: string; token?: string }>;
}) {
  const params = searchParams ? await searchParams : undefined;
  const token = String(params?.token ?? "").trim();

  let inviteEmail: string | null = null;
  let inviteSummary:
    | {
        inviterEmail: string;
        organizationName: string | null;
        roleLabel: string;
      }
    | null = null;
  if (token) {
    const invite = await getInviteByToken(token);
    if (invite && invite.status === "pending") {
      inviteEmail = invite.email;
      inviteSummary = {
        inviterEmail: invite.inviterEmail,
        organizationName: invite.organizationName,
        roleLabel: getSystemRoleMeta(invite.role).label,
      };
    }
  }

  const callbackURL = token ? `/invite/accept?token=${encodeURIComponent(token)}` : "/unidep";

  return (
    <BrandedAuthShell
      eyebrow={inviteEmail ? "Invitación" : "Alta"}
      title="Crear cuenta"
      surfaceTitle={inviteEmail ? "Activa tu acceso" : "Registra una cuenta"}
      footer={
        <div className="ui-auth-links text-xs">
          <div className="text-slate-300">
            ¿Ya tienes cuenta?{" "}
            <Link
              className="ui-auth-link"
              href={
                token
                  ? `/auth/sign-in?fromInvite=1&email=${encodeURIComponent(inviteEmail ?? "")}&next=${encodeURIComponent(callbackURL)}`
                  : "/auth/sign-in"
              }
            >
              Iniciar sesión
            </Link>
          </div>
          <div className="text-slate-400">
            <Link className="ui-auth-link" href="/invite/accept">
              Tengo una invitación
            </Link>
          </div>
          <div className="text-slate-400">
            <Link className="ui-auth-link" href="/">
              Volver al inicio
            </Link>
          </div>
        </div>
      }
    >
      {inviteSummary ? (
        <div className="ui-note ui-note--success text-sm">
          <div className="font-semibold">Resumen de invitación</div>
          <div className="mt-1">
            Invitó {inviteSummary.inviterEmail}. Acceso: {inviteSummary.roleLabel}.
            {inviteSummary.organizationName ? ` Organización: ${inviteSummary.organizationName}.` : ""}
          </div>
        </div>
      ) : null}

      {params?.error ? (
        <div className="ui-note ui-note--danger text-sm">
          {params.error}
        </div>
      ) : null}

      {params?.success ? (
        <div className="ui-note ui-note--success text-sm">
          {params.success}
        </div>
      ) : null}

      <div className="grid gap-3">
        <GoogleSignInButton callbackURL={callbackURL} />
        <NeonUserAuthMethods
          callbackURL={callbackURL}
          defaultEmail={inviteEmail ?? ""}
          lockedEmail={Boolean(inviteEmail)}
          mode="sign-up"
        />
      </div>

      <div className="ui-auth-divider">o crea contraseña</div>

      <form action="/api/auth/sign-up" method="post" className="ui-auth-form">
        {token ? <input type="hidden" name="token" value={token} /> : null}

        <label className="ui-auth-form-label">
          Correo
          <input
            name="email"
            type="email"
            placeholder="nombre@unidep.edu.mx"
            defaultValue={inviteEmail ?? ""}
            readOnly={!!inviteEmail}
            autoComplete="username"
            className="ui-control ui-auth-control read-only:cursor-not-allowed read-only:opacity-70"
          />
        </label>
        <label className="ui-auth-form-label">
          Contraseña
          <PasswordField
            name="password"
            placeholder="Crea una contraseña"
            autoComplete="new-password"
            className="ui-control ui-auth-control pl-3.5 pr-12"
          />
        </label>
        <button
          type="submit"
          className="ui-button-primary w-full justify-center"
        >
          Crear cuenta
        </button>
      </form>
    </BrandedAuthShell>
  );
}
