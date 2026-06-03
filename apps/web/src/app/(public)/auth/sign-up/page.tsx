import Link from "next/link";

import AuthMethodSwitcher from "@/components/auth/AuthMethodSwitcher";
import BrandedAuthShell from "@/components/auth/BrandedAuthShell";
import { getInviteByToken } from "@/lib/invites";
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

      <AuthMethodSwitcher
        mode="sign-up"
        callbackURL={callbackURL}
        defaultEmail={inviteEmail ?? ""}
        lockedEmail={Boolean(inviteEmail)}
        token={token}
      />
    </BrandedAuthShell>
  );
}
