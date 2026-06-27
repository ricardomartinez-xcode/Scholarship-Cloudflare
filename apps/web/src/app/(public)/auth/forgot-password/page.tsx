import Link from "next/link";

import BrandedAuthShell from "@/components/auth/BrandedAuthShell";
import { ForgotPasswordCardForm } from "@/components/auth/NeonAuthForms";
import { isCloudflareRuntime } from "@/lib/cloudflare/runtime";

export const dynamic = "force-dynamic";

export default function ForgotPasswordPage() {
  const cloudflareRuntime = isCloudflareRuntime();

  return (
    <BrandedAuthShell
      eyebrow="Seguridad"
      title="Recuperar contraseña"
      surfaceTitle={
        cloudflareRuntime
          ? "Restablecimiento administrado"
          : "Solicita un enlace seguro"
      }
      footer={
        <div className="ui-auth-links text-xs">
          <div className="text-slate-400">
            <Link className="ui-auth-link" href="/auth/sign-in">
              Volver a iniciar sesión
            </Link>
          </div>
        </div>
      }
    >
      {cloudflareRuntime ? (
        <div className="ui-note ui-note--warning text-sm">
          El restablecimiento automático de contraseña todavía no está habilitado
          en el despliegue Cloudflare. Contacta al administrador de tu organización
          para recuperar el acceso.
        </div>
      ) : (
        <ForgotPasswordCardForm />
      )}
    </BrandedAuthShell>
  );
}
