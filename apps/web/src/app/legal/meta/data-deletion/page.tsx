import { getMetaLegalUrls, getMetaSupportEmail } from "@/lib/meta-legal";

export const metadata = {
  title: "Eliminación de datos de Meta | ReCalc",
  description:
    "Instrucciones públicas para solicitar la eliminación de datos asociados a integraciones de Meta / WhatsApp en ReCalc.",
};

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function MetaDataDeletionPage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
  const supportEmail = getMetaSupportEmail();
  const legalUrls = getMetaLegalUrls();
  const code = firstValue(params.code);

  return (
    <>
      <section id="solicitud" className="scroll-mt-24">
        <h2 className="text-base font-semibold text-slate-50">
          1. Cómo solicitar la eliminación
        </h2>
        <div className="mt-3 space-y-3">
          <p>
            Si deseas solicitar la eliminación de datos asociados con nuestra integración de
            Meta / WhatsApp, puedes escribir a{" "}
            <a
              href={`mailto:${supportEmail}`}
              className="underline decoration-white/20 underline-offset-4 hover:decoration-white/50"
            >
              {supportEmail}
            </a>{" "}
            e indicar el número de teléfono, cuenta o contexto con el que realizaste la
            conexión.
          </p>
          <p>
            También puedes compartir esta URL pública con Meta como página de instrucciones de
            eliminación de datos:
          </p>
          <p className="break-all rounded-2xl border border-white/10 bg-slate-950/55 px-3 py-2 text-slate-100">
            {legalUrls.dataDeletionRequestUrl}
          </p>
        </div>
      </section>

      <section id="alcance" className="scroll-mt-24">
        <h2 className="text-base font-semibold text-slate-50">2. Alcance de la eliminación</h2>
        <div className="mt-3 space-y-3">
          <p>
            La solicitud puede incluir la eliminación o desvinculación de datos operativos
            asociados a la conexión de WhatsApp Business y a eventos registrados por la
            integración, sujeto a obligaciones legales, operativas y de seguridad aplicables.
          </p>
          <p>
            Si Meta nos envía una solicitud automatizada, responderemos con una referencia de
            confirmación y el estado de seguimiento correspondiente.
          </p>
        </div>
      </section>

      <section id="confirmacion" className="scroll-mt-24">
        <h2 className="text-base font-semibold text-slate-50">
          3. Confirmación y seguimiento
        </h2>
        <div className="mt-3 space-y-3">
          {code ? (
            <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-emerald-100">
              Código de confirmación: <span className="font-semibold">{code}</span>
            </div>
          ) : null}
          <p>
            Si tu solicitud provino desde Meta y recibiste un código de confirmación, consérvalo
            para futuras consultas. Si tienes dudas, contáctanos por correo indicando ese código.
          </p>
          <p className="break-all rounded-2xl border border-white/10 bg-slate-950/55 px-3 py-2 text-slate-100">
            Callback técnico de Meta: {legalUrls.dataDeletionCallbackUrl}
          </p>
        </div>
      </section>
    </>
  );
}
