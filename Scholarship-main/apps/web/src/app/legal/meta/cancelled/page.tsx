import Link from "next/link";

import { getMetaLegalUrls, getMetaSupportEmail } from "@/lib/meta-legal";

export const metadata = {
  title: "Autorización cancelada | ReCalc",
  description:
    "Página pública para redirección cuando una persona cancela la autorización de Meta / WhatsApp en ReCalc.",
};

export default function MetaCancelledPage() {
  const legalUrls = getMetaLegalUrls();
  const supportEmail = getMetaSupportEmail();

  return (
    <>
      <section id="estado" className="scroll-mt-24">
        <h2 className="text-base font-semibold text-slate-50">1. Estado de la solicitud</h2>
        <div className="mt-3 space-y-3">
          <p>
            La solicitud de autorización con Meta / WhatsApp fue cancelada antes de finalizar.
            No se completó la conexión de la cuenta con ReCalc.
          </p>
          <p>
            Si esta cancelación fue intencional, no necesitas realizar ninguna otra acción.
            Si fue un error, puedes regresar a ReCalc e iniciar el proceso nuevamente.
          </p>
        </div>
      </section>

      <section id="siguiente" className="scroll-mt-24">
        <h2 className="text-base font-semibold text-slate-50">2. Qué sigue</h2>
        <div className="mt-3 space-y-3">
          <p>
            Para volver a conectar tu cuenta, inicia sesión en ReCalc y entra a la pestaña WABA.
          </p>
          <p>
            Si también deseas revisar el proceso de eliminación de datos asociado a Meta, consulta{" "}
            <Link
              href={legalUrls.dataDeletionRequestUrl}
              className="underline decoration-white/20 underline-offset-4 hover:decoration-white/50"
            >
              esta página
            </Link>
            .
          </p>
        </div>
      </section>

      <section id="soporte" className="scroll-mt-24">
        <h2 className="text-base font-semibold text-slate-50">3. Soporte</h2>
        <div className="mt-3 space-y-3">
          <p>
            Si necesitas ayuda para completar la autorización o para revisar el estado de una
            conexión, escríbenos a{" "}
            <a
              href={`mailto:${supportEmail}`}
              className="underline decoration-white/20 underline-offset-4 hover:decoration-white/50"
            >
              {supportEmail}
            </a>
            .
          </p>
        </div>
      </section>
    </>
  );
}
