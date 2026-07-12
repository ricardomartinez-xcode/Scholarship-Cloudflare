import Link from "next/link";

import RecalcAdminShortcutLogo from "@/components/public/RecalcAdminShortcutLogo";

export const metadata = {
  title: "Integración con Google | ReCalc",
  description:
    "Página pública de ReCalc para explicar el uso de Google Calendar, Google Tasks y Google Sheets dentro del producto y su proceso de verificación OAuth.",
};

const GOOGLE_DATA_AREAS = [
  {
    title: "Google Calendar",
    description:
      "Se usa para crear o sincronizar eventos y recordatorios operativos asociados al trabajo del usuario dentro de ReCalc.",
  },
  {
    title: "Google Tasks",
    description:
      "Se usa para registrar tareas personales del usuario relacionadas con seguimiento, pendientes y recordatorios operativos.",
  },
  {
    title: "Google Sheets",
    description:
      "Se usa para sincronizar la base híbrida de contactos y hojas operativas del propio usuario sin sobrecargar el almacenamiento principal de la app.",
  },
  {
    title: "Perfil básico de Google",
    description:
      "Se usa para identificar la cuenta conectada y vincularla correctamente con la sesión activa del usuario en ReCalc.",
  },
];

const CONTROL_POINTS = [
  "La conexión con Google solo se activa por acción explícita del usuario autenticado.",
  "Cada usuario administra únicamente su propia conexión y sus propios datos sincronizados.",
  "La desconexión o cambio de permisos puede hacerse desde la cuenta Google o desde la configuración de la app.",
  "La información de Google se usa para funciones internas del producto; no se vende ni se publica a terceros.",
];

const CALLBACK_POINTS = [
  "El login social con Google puede usar el mismo cliente OAuth que la sincronización de Calendar, Tasks y Sheets.",
  "Cuando se comparte el cliente OAuth, Google debe tener autorizados dos redirect URIs: el callback de Supabase Auth y el callback de sincronización de ReCalc.",
  "Si se prefiere aislar riesgos, ReCalc también soporta un cliente OAuth dedicado solo para la sincronización Google.",
];

export default function GoogleIntegrationPage() {
  return (
    <section className="flex flex-1 items-start py-5 sm:py-7 lg:py-10">
      <div className="grid w-full gap-[var(--ui-shell-gap)]">
        <div className="ui-card overflow-hidden p-[clamp(20px,2vw,30px)]">
          <div className="grid gap-7 xl:grid-cols-[minmax(0,1.18fr)_minmax(320px,400px)] xl:items-start">
            <div className="grid gap-6">
              <div className="flex flex-wrap items-center gap-3">
                <RecalcAdminShortcutLogo className="h-[60px] w-auto select-none object-contain sm:h-[74px]" />
                <span className="ui-pill ui-pill--accent">
                  Integración oficial con Google
                </span>
              </div>

              <div className="grid gap-3">
                <div className="ui-kicker">Página principal de verificación OAuth</div>
                <h1 className="ui-title-hero">
                  ReCalc conecta Google para agenda, tareas y contactos del usuario.
                </h1>
                <p className="ui-copy-lg max-w-3xl">
                  ReCalc es una plataforma operativa para cotización, seguimiento,
                  agenda, campañas y gestión de contactos. La integración con Google
                  permite que cada usuario sincronice sus propios recordatorios,
                  tareas y hojas de trabajo directamente desde su cuenta.
                </p>
              </div>

              <div className="flex flex-wrap gap-2.5">
                <span className="ui-pill">Agenda sincronizada</span>
                <span className="ui-pill">Contactos híbridos</span>
                <span className="ui-pill">Control por usuario</span>
              </div>
            </div>

            <div className="ui-grid-panel grid gap-4 self-start p-5 sm:p-6">
              <div className="ui-kicker">Acceso</div>
              <div className="grid gap-3 rounded-[24px] border border-white/8 bg-slate-950/45 p-4">
                <div className="text-sm text-slate-300">
                  Esta información es pública para cumplir verificación de Google.
                  Para conectar tu cuenta, primero inicia sesión en ReCalc.
                </div>
                <Link
                  href="/auth/sign-in"
                  className="ui-cta-primary w-full text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(31,108,140,0.3)]"
                >
                  Iniciar sesión
                </Link>
              </div>

              <div className="grid gap-3 rounded-[24px] border border-white/8 bg-slate-950/35 p-4">
                <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">
                  Enlaces legales
                </div>
                <div className="grid gap-2 text-sm">
                  <Link
                    href="/legal/privacy"
                    className="font-semibold text-slate-100 underline decoration-white/20 underline-offset-4"
                  >
                    Política de Privacidad
                  </Link>
                  <Link
                    href="/legal/terms"
                    className="font-semibold text-slate-100 underline decoration-white/20 underline-offset-4"
                  >
                    Términos y Condiciones
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-[var(--ui-shell-gap)] xl:grid-cols-[minmax(0,1.08fr)_minmax(320px,388px)]">
          <div className="ui-card p-[var(--ui-card-pad)]">
            <div className="ui-kicker">Uso de datos de Google</div>
            <div className="mt-3 grid gap-3">
              {GOOGLE_DATA_AREAS.map((item) => (
                <div
                  key={item.title}
                  className="rounded-[24px] border border-white/8 bg-slate-950/35 p-4"
                >
                  <div className="text-base font-semibold text-slate-50">
                    {item.title}
                  </div>
                  <p className="mt-2 text-sm text-slate-300">{item.description}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid content-start gap-[var(--ui-card-gap)]">
            <div className="ui-card p-[var(--ui-card-pad)]">
              <div className="ui-kicker">Control del usuario</div>
              <div className="mt-3 grid gap-3">
                {CONTROL_POINTS.map((point) => (
                  <div
                    key={point}
                    className="rounded-[24px] border border-white/8 bg-slate-950/35 px-4 py-3 text-sm text-slate-200"
                  >
                    {point}
                  </div>
                ))}
              </div>
            </div>

            <div className="ui-card p-[var(--ui-card-pad)]">
              <div className="ui-kicker">Alcance del producto</div>
              <div className="mt-3 grid gap-3 text-sm text-slate-300">
                <p>
                  La integración de Google se usa dentro del workspace de ReCalc
                  para conectar agenda, tareas operativas y sincronización de
                  contactos por usuario.
                </p>
                <p>
                  La app también cuenta con una extensión de Chrome para apoyar
                  flujos de operación y campañas, pero la administración central y
                  la conexión OAuth viven en el dominio principal de ReCalc.
                </p>
              </div>
            </div>

            <div className="ui-card p-[var(--ui-card-pad)]">
              <div className="ui-kicker">OAuth y callbacks</div>
              <div className="mt-3 grid gap-3">
                {CALLBACK_POINTS.map((point) => (
                  <div
                    key={point}
                    className="rounded-[24px] border border-white/8 bg-slate-950/35 px-4 py-3 text-sm text-slate-200"
                  >
                    {point}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
