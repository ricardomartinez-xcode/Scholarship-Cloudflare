import { redirect } from "next/navigation";

import BrandedAuthShell from "@/components/auth/BrandedAuthShell";
import PasswordField from "@/components/auth/PasswordField";
import { auth } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

const OFFICIAL_SIGN_UP_URL = "/auth/sign-up";
const OFFICIAL_FORGOT_PASSWORD_URL = "/auth/forgot-password";
const OFFICIAL_SIGN_IN_URL = "/auth/sign-in";

export default async function ExtensionSignInPage({
  searchParams,
}: {
  searchParams?: Promise<{
    email?: string;
    error?: string;
    success?: string;
  }>;
}) {
  const params = searchParams ? await searchParams : undefined;

  let session: Awaited<ReturnType<typeof auth.getSession>>["data"] | null = null;
  ({ data: session } = await auth.getSession());
  if (session?.user) {
    redirect("/extension");
  }

  return (
    <BrandedAuthShell
      eyebrow="Extensión"
      description="Inicia sesión para usar ReCalc dentro de Chrome. El alta de cuenta se hace en el sitio oficial."
      compact
    >

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

        <form
          action="/api/extension/auth/sign-in"
          method="post"
          className="grid gap-3.5"
        >
          <input type="hidden" name="next" value="/extension" />

          <label className="grid gap-2 text-sm">
            Correo
            <input
              name="email"
              type="email"
              placeholder="nombre@unidep.edu.mx"
              defaultValue={params?.email ?? ""}
              autoComplete="username"
              className="w-full rounded-2xl border border-white/10 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 shadow-sm outline-none transition focus:border-emerald-400/50 focus:ring-2 focus:ring-emerald-500/20"
            />
          </label>

          <label className="grid gap-2 text-sm">
            Contraseña
            <PasswordField
              name="password"
              placeholder="Tu contraseña"
              autoComplete="current-password"
              className="w-full rounded-2xl border border-white/10 bg-slate-950/40 pl-3 pr-12 py-2 text-sm text-slate-100 shadow-sm outline-none transition focus:border-emerald-400/50 focus:ring-2 focus:ring-emerald-500/20"
            />
          </label>

          <button
            type="submit"
            className="ui-button-primary w-full"
          >
            Iniciar sesión
          </button>
        </form>

        <div className="mt-4 grid gap-2 text-center text-xs text-slate-300">
          <a
            className="underline"
            href={OFFICIAL_FORGOT_PASSWORD_URL}
            target="_blank"
            rel="noreferrer"
          >
            Restablecer contraseña en sitio oficial
          </a>
          <a
            className="underline"
            href={OFFICIAL_SIGN_UP_URL}
            target="_blank"
            rel="noreferrer"
          >
            Crear cuenta en sitio oficial
          </a>
          <a
            className="underline text-slate-400"
            href={OFFICIAL_SIGN_IN_URL}
            target="_blank"
            rel="noreferrer"
          >
            Abrir login completo en una pestaña
          </a>
        </div>
    </BrandedAuthShell>
  );
}
