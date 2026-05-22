"use client";

import { usePathname } from "next/navigation";

import AppFooter from "@/components/app/AppFooter";
import MetaPixel from "@/components/analytics/MetaPixel";

const LAST_UPDATED = "10 de febrero de 2026";

type TocItem = { id: string; label: string };
type LegalDocConfig = { title: string; toc: TocItem[] };

const PRIVACY: LegalDocConfig = {
  title: "Política de Privacidad",
  toc: [
    { id: "definiciones", label: "1. Definiciones" },
    { id: "responsable", label: "2. Identidad y domicilio del responsable" },
    { id: "datos", label: "3. Datos que se recaban" },
    { id: "finalidades", label: "4. Finalidades" },
    { id: "base-legal", label: "5. Base legal, consentimiento y opciones" },
    { id: "transferencias", label: "6. Encargados, proveedores y transferencias" },
    { id: "conservacion", label: "7. Conservación" },
    { id: "derechos", label: "8. Derechos del titular (ARCO y equivalentes)" },
    { id: "cookies", label: "9. Cookies y tecnologías similares" },
    { id: "seguridad", label: "10. Seguridad" },
    { id: "cambios", label: "11. Cambios a esta política" },
    { id: "jurisdiccion", label: "12. Jurisdicción y contacto" },
  ],
};

const TERMS: LegalDocConfig = {
  title: "Términos y Condiciones",
  toc: [
    { id: "aceptacion", label: "1. Aceptación" },
    { id: "definiciones", label: "2. Definiciones" },
    { id: "elegibilidad", label: "3. Elegibilidad y uso permitido" },
    { id: "cuentas", label: "4. Cuentas y credenciales" },
    { id: "propiedad", label: "5. Propiedad intelectual" },
    { id: "calculadora", label: "6. Naturaleza informativa de los cálculos" },
    { id: "disponibilidad", label: "7. Disponibilidad e interrupciones" },
    { id: "responsabilidad", label: "8. Limitación de responsabilidad" },
    { id: "terminacion", label: "9. Terminación" },
    { id: "cambios", label: "10. Cambios a los términos" },
    { id: "ley", label: "11. Ley aplicable y jurisdicción" },
    { id: "contacto", label: "12. Contacto" },
  ],
};

const META_CANCELLED: LegalDocConfig = {
  title: "Autorización de Meta cancelada",
  toc: [
    { id: "estado", label: "1. Estado de la solicitud" },
    { id: "siguiente", label: "2. Qué sigue" },
    { id: "soporte", label: "3. Soporte" },
  ],
};

const META_DATA_DELETION: LegalDocConfig = {
  title: "Eliminación de datos de Meta / WhatsApp",
  toc: [
    { id: "solicitud", label: "1. Cómo solicitar la eliminación" },
    { id: "alcance", label: "2. Alcance de la eliminación" },
    { id: "confirmacion", label: "3. Confirmación y seguimiento" },
  ],
};

function pickDoc(pathname: string): LegalDocConfig {
  if (pathname.endsWith("/privacy")) return PRIVACY;
  if (pathname.endsWith("/terms")) return TERMS;
  if (pathname.endsWith("/meta/cancelled")) return META_CANCELLED;
  if (pathname.endsWith("/meta/data-deletion")) return META_DATA_DELETION;
  return { title: "Avisos Legales", toc: [] };
}

export default function LegalLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname() ?? "";
  const doc = pickDoc(pathname);

  return (
    <main className="ui-page-backdrop min-h-screen text-slate-100">
      <MetaPixel />
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-8 sm:px-6 sm:py-10">
        <div className="mx-auto w-full max-w-4xl">
          <div className="ui-card p-7 sm:p-10">
            <div className="flex flex-col gap-3">
              <div className="ui-kicker">
                Legal
              </div>
              <h1 className="ui-title-section text-slate-50 sm:text-4xl">
                {doc.title}
              </h1>
              <div className="text-sm text-slate-300">
                Última actualización: {LAST_UPDATED}
              </div>
            </div>

            {doc.toc.length ? (
              <nav
                aria-label="Tabla de contenido"
                className="ui-card-muted mt-8 p-4"
              >
                <div className="ui-kicker">
                  Contenido
                </div>
                <ol className="mt-3 grid gap-2 text-sm">
                  {doc.toc.map((item) => (
                    <li key={item.id}>
                      <a
                        href={`#${item.id}`}
                        className="text-slate-200 underline decoration-white/20 underline-offset-4 transition hover:decoration-white/40"
                      >
                        {item.label}
                      </a>
                    </li>
                  ))}
                </ol>
              </nav>
            ) : null}

            <div className="mt-10 space-y-10 text-sm leading-7 text-slate-200">
              {children}
            </div>
          </div>
        </div>

        <AppFooter />
      </div>
    </main>
  );
}
