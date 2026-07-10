import Link from "next/link";

import BrandedAuthShell from "@/components/auth/BrandedAuthShell";
import { ForgotPasswordCardForm } from "@/components/auth/NeonAuthForms";

export const dynamic = "force-dynamic";

export default function ForgotPasswordPage() {
  return (
    <BrandedAuthShell
      eyebrow="Seguridad"
      title="Recuperar contraseña"
      surfaceTitle="Solicita un enlace seguro"
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
      <ForgotPasswordCardForm />
    </BrandedAuthShell>
  );
}
