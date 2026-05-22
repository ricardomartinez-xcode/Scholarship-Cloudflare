import Link from "next/link";
import BrandedAuthShell from "@/components/auth/BrandedAuthShell";

export const dynamic = "force-dynamic";

export default function DeniedPage() {
  return (
    <BrandedAuthShell
      eyebrow="Seguridad"
      title="Acceso bloqueado"
      surfaceTitle="No pudimos autorizar este acceso"
      footer={
        <div className="ui-auth-action-row">
          <Link href="/" className="ui-button-secondary">
            Volver al inicio
          </Link>
          <Link href="/auth/sign-in" className="ui-button-primary">
            Iniciar sesión
          </Link>
        </div>
      }
    >
      <div className="ui-note ui-note--danger text-sm">
        Tu cuenta no tiene permisos para acceder a esta sección.
      </div>
    </BrandedAuthShell>
  );

}
