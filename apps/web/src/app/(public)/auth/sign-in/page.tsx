import Link from "next/link";

import AuthMethodSwitcher from "@/components/auth/AuthMethodSwitcher";
import PublicPageShell from "@/components/PublicPageShell";
import UiAlert from "@/components/ui/UiAlert";
import { safeInternalPath } from "@/lib/authz";

export const dynamic = "force-dynamic";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : "";
  const success = typeof params.success === "string" ? params.success : "";
  const token = typeof params.token === "string" ? params.token : "";
  const email = typeof params.email === "string" ? params.email : "";
  const fromInvite = params.fromInvite === "1";
  const forcePassword = params.method === "password" || params.verified === "1";
  const next = safeInternalPath(typeof params.next === "string" ? params.next : undefined, "/unidep");
  const callbackURL = `/auth/callback?next=${encodeURIComponent(next)}`;

  return (
    <PublicPageShell narrow>
      <header className="ui-public-header">
        <h1 className="ui-public-title">Iniciar sesión</h1>
      </header>

      {error ? <UiAlert tone="error" title="Error">{error}</UiAlert> : null}
      {success ? <UiAlert tone="success">{success}</UiAlert> : null}

      <AuthMethodSwitcher
        mode="sign-in"
        callbackURL={callbackURL}
        defaultEmail={email}
        lockedEmail={Boolean(email && fromInvite)}
        next={next}
        fromInvite={fromInvite}
        token={token}
        initialMethod={fromInvite || forcePassword ? "password" : "passwordless"}
      />

      <nav className="ui-public-nav" aria-label="Opciones de acceso">
        <p className="ui-public-muted">
          ¿No tienes cuenta? <Link href="/auth/sign-up">Crear cuenta</Link>
        </p>
        <Link href="/invite/accept">Tengo una invitación</Link>
        <Link href="/">Volver al inicio</Link>
      </nav>
    </PublicPageShell>
  );
}
