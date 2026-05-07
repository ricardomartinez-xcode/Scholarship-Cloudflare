import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth/server";
import BrandedAuthShell from "@/components/auth/BrandedAuthShell";
import GoogleSignInButton from "@/components/auth/GoogleSignInButton";
import PasswordField from "@/components/auth/PasswordField";
import { getInviteByToken } from "@/lib/invites";
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

  // If already authenticated, redirect away from the sign-in page
  let session: Awaited<ReturnType<typeof auth.getSession>>["data"] | null = null;
  if (process.env.NEON_AUTH_BASE_URL?.trim()) {
    ({ data: session } = await auth.getSession());
  }
  if (session?.user) {
    redirect(next || "/unidep");
  }

  return (
    <BrandedAuthShell
      eyebrow={fromInvite ? "Invitación" : "Acceso"}
      surfaceTitle="Iniciar sesión"
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

      <form action="/api/auth/sign-in" method="post" className="ui-auth-form">
        <input type="hidden" name="next" value={next} />
        {fromInvite ? <input type="hidden" name="fromInvite" value="1" /> : null}

        <GoogleSignInButton callbackURL={next || "/unidep"} />

        <div className="ui-auth-divider">o</div>

        <label className="ui-auth-form-label">
          Correo
          <input
            name="email"
            type="email"
            placeholder="nombre@unidep.edu.mx"
            defaultValue={prefilledEmail}
            readOnly={fromInvite && !!prefilledEmail}
            autoComplete="username"
            className="ui-control ui-auth-control read-only:cursor-not-allowed read-only:opacity-70"
          />
        </label>

        <label className="ui-auth-form-label">
          Contraseña
          <PasswordField
            name="password"
            placeholder="Tu contraseña"
            autoComplete="current-password"
            className="ui-control ui-auth-control pl-3.5 pr-12"
          />
        </label>

        <div className="ui-auth-helper-row">
          <Link
            href={
              prefilledEmail
                ? `/auth/forgot-password?email=${encodeURIComponent(prefilledEmail)}`
                : "/auth/forgot-password"
            }
            className="ui-auth-link text-sm"
          >
            ¿Olvidaste tu contraseña?
          </Link>
        </div>

        <button
          type="submit"
          className="ui-button-primary w-full justify-center"
        >
          Iniciar sesión
        </button>
      </form>
    </BrandedAuthShell>
  );
}
