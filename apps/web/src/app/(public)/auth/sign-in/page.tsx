import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth/server";
import AuthMethodSwitcher from "@/components/auth/AuthMethodSwitcher";
import BrandedAuthShell from "@/components/auth/BrandedAuthShell";
import { getInviteByToken } from "@/lib/invites";
import { getVerifiedNeonAuthOAuthProviders, toOAuthProviderOptions } from "@/lib/neon-auth-oauth";
import { getSystemRoleMeta } from "@/lib/system-roles";

export const dynamic = "force-dynamic";

export default async function SignInPage({
  searchParams,
}: {
  searchParams?: Promise<{
    error?: string;
    success?: string;
    next?: string;
    email?: string;
    fromInvite?: string;
  }>;
}) {
  const params = searchParams ? await searchParams : undefined;
  const next = params?.next && params.next.startsWith("/") ? params.next : "";
  const prefilledEmail = params?.email ?? "";
  const fromInvite = params?.fromInvite === "1";
  const inviteToken = fromInvite
    ? new URLSearchParams(next.split("?")[1] ?? "").get("token")?.trim() ?? ""
    : "";
  const invite = inviteToken ? await getInviteByToken(inviteToken) : null;
  const inviteRoleLabel = invite ? getSystemRoleMeta(invite.role).label : "Invitación pendiente";

  let session: Awaited<ReturnType<typeof auth.getSession>>["data"] | null = null;
  if (process.env.NEON_AUTH_BASE_URL?.trim()) {
    ({ data: session } = await auth.getSession());
  }
  if (session?.user) {
    redirect(next || "/unidep");
  }
  const oauthProviders = toOAuthProviderOptions(await getVerifiedNeonAuthOAuthProviders());

  return (
    <BrandedAuthShell
      eyebrow={fromInvite ? "Invitación" : "Acceso"}
      surfaceTitle="Iniciar sesión"
      surfaceDescription={
        fromInvite
          ? "Usa el correo invitado. Las opciones externas solo aparecen cuando están disponibles."
          : "Entra con correo y contraseña. Las opciones externas solo aparecen cuando están disponibles."
      }
      footer={
        <div className="ui-auth-links text-xs">
          <div className="text-slate-300">
            ¿No tienes cuenta?{" "}
            <Link
              href={
                inviteToken
                  ? `/auth/sign-up?token=${encodeURIComponent(inviteToken)}`
                  : "/auth/sign-up"
              }
              className="ui-auth-link"
            >
              Crear cuenta
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
      {fromInvite ? (
        <div className="ui-note ui-note--success text-sm">
          <div className="font-semibold">Acceso por invitación</div>
          <div className="mt-1">
            Inicia sesión con el correo invitado.
            {invite ? (
              <>
                {" "}Te invitó {invite.inviterEmail} con acceso {inviteRoleLabel}
                {invite.organizationName ? ` a ${invite.organizationName}` : ""}.
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      {params?.error ? (
        <div className="ui-note ui-note--danger text-sm">
          <div className="font-semibold">Error</div>
          <div className="mt-1 font-semibold text-red-700">{params.error}</div>
        </div>
      ) : null}

      {params?.success ? (
        <div className="ui-note ui-note--success text-sm">
          <div className="font-semibold">Éxito</div>
          <div className="mt-1 text-slate-100/80">{params.success}</div>
        </div>
      ) : null}

      <AuthMethodSwitcher
        mode="sign-in"
        callbackURL={next || "/unidep"}
        defaultEmail={prefilledEmail}
        lockedEmail={fromInvite && !!prefilledEmail}
        next={next}
        fromInvite={fromInvite}
        oauthProviders={oauthProviders}
      />
    </BrandedAuthShell>
  );
}
