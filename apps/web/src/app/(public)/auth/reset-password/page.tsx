import Link from "next/link";

import BrandedAuthShell from "@/components/auth/BrandedAuthShell";
import { ResetPasswordCardForm } from "@/components/auth/NeonAuthForms";

export const dynamic = "force-dynamic";

export default function ResetPasswordPage() {
  return (
    <BrandedAuthShell
      eyebrow="Seguridad"
      title="Restablecer contraseña"
      surfaceTitle="Define una contraseña nueva"
      footer={
        <div className="ui-auth-links text-xs">
          <div className="text-slate-400">
            <Link className="ui-auth-link" href="/auth/forgot-password">
              Solicitar nuevo enlace
            </Link>
          </div>
        </div>
      }
    >
      <ResetPasswordCardForm />
    </BrandedAuthShell>
  );

}
