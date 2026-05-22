import Link from "next/link";
import { redirect } from "next/navigation";

import BrandedAuthShell from "@/components/auth/BrandedAuthShell";
import PasswordField from "@/components/auth/PasswordField";
import { getSessionUser } from "@/lib/authz";
import { canAccessAdminPanel, resolveAdminCapabilities } from "@/lib/admin-capabilities";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminAuthPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const params = searchParams ? await searchParams : undefined;

  const state = await getSessionUser();
  if (state.status === "ok") {
    const overrides = await prisma.adminUserCapability.findMany({
      where: { userId: state.user.id },
      select: { capability: true, enabled: true },
    });
    const capabilities = resolveAdminCapabilities(state.user.role, overrides);
    if (canAccessAdminPanel(state.user.role, capabilities)) {
      redirect("/admin");
    }
  }

  return (
    <BrandedAuthShell
      eyebrow="Administración"
      title="Panel de administración"
      surfaceTitle="Valida tu acceso administrativo"
      surfaceDescription="Tus permisos reales se resuelven después del login con el mismo stack actual."
      supportingPoints={[
        "Este acceso se controla por rol del sistema y por capacidades efectivas del usuario.",
        "Si tu cuenta ya tiene permiso, entrarás al panel sin tocar la configuración de auth actual.",
        "La validación administrativa ocurre después de iniciar sesión, no en el diseño visual.",
      ]}
      highlights={[
        { label: "Cobertura", value: "Roles + capabilities" },
        { label: "Destino", value: "Panel administrativo protegido" },
      ]}
      description="Acceso restringido según tu rol del sistema y permisos efectivos."
      footer={
        <div className="ui-auth-links text-xs">
          <div className="text-slate-400">
            <Link href="/" className="ui-auth-link">
              Volver al inicio
            </Link>
          </div>
          <p className="ui-auth-footer-copy">ReCalc · Sistema de Becas UNIDEP</p>
        </div>
      }
      compact
    >
      {params?.error ? (
        <div className="ui-note ui-note--danger text-sm">
          <span>{params.error}</span>
        </div>
      ) : null}

      <form action="/api/admin/sign-in" method="post" className="ui-auth-form">
        <div className="ui-auth-inline-note">
          Continúa con la misma cuenta que tiene permisos administrativos activos.
        </div>

        <label className="ui-auth-form-label">
          Correo
          <input
            name="email"
            type="email"
            autoComplete="username"
            placeholder="correo@dominio.com"
            className="ui-control ui-auth-control"
          />
        </label>

        <label className="ui-auth-form-label">
          Contraseña
          <PasswordField
            name="password"
            autoComplete="current-password"
            placeholder="••••••••"
            className="ui-control ui-auth-control pl-3.5 pr-12"
          />
        </label>

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
