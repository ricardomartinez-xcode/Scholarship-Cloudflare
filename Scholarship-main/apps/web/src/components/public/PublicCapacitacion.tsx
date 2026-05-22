import Link from "next/link";

export default function PublicCapacitacion() {
  const items = [
    {
      label: "Materiales",
      copy: "Documentos, guías y recursos listos para consultar.",
    },
    {
      label: "Rolplay",
      copy: "Escenarios reales para practicar conversaciones clave.",
    },
    {
      label: "Evaluaciones",
      copy: "Medición de progreso con actividades interactivas.",
    },
    {
      label: "Sesiones",
      copy: "Acompañamiento dirigido por especialistas.",
    },
  ];

  return (
    <section id="capacitacion" className="border-t border-[#D7E4ED] bg-[#F4F9FC] py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-[var(--ui-shell-pad-x)]">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,0.95fr)_minmax(360px,1.05fr)] lg:items-center">
          <div className="space-y-6">
            <div>
              <h2 className="text-3xl font-bold text-[#0F3C55] sm:text-4xl">
                Capacitación integrada
              </h2>
            </div>

            <p className="text-lg leading-relaxed text-[#4f6b81]">
              Accede a un espacio de aprendizaje colaborativo con sesiones,
              materiales y ejercicios para mejorar el acompañamiento comercial.
            </p>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              {items.map((item) => (
                <div key={item.label} className="flex gap-3 rounded-lg border border-[#D7E4ED] bg-white p-4">
                  <span className="mt-1 h-2.5 w-2.5 rounded-full bg-[#6CB514]" aria-hidden="true" />
                  <div>
                    <h4 className="font-semibold text-[#0F3C55]">{item.label}</h4>
                    <p className="text-sm leading-6 text-[#657D8F]">{item.copy}</p>
                  </div>
                </div>
              ))}
            </div>

            <Link
              href="/auth/sign-up"
              className="mt-2 inline-flex items-center gap-2 rounded-[7px] bg-[#114E6D] px-6 py-3 font-semibold text-white transition hover:bg-[#0F3C55] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(17,78,109,0.24)]"
            >
              Acceder a capacitación
              <span aria-hidden="true">-&gt;</span>
            </Link>
          </div>

          <div className="relative hidden lg:block">
            <div className="rounded-lg border border-[#D7E4ED] bg-white p-5 shadow-[0_22px_50px_rgba(18,51,72,0.1)]">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-[#0F3C55]">Ruta de capacitación</p>
                  <p className="text-xs text-[#657D8F]">Progreso sugerido</p>
                </div>
                <span className="rounded-[6px] bg-[#EDF7E2] px-2.5 py-1 text-xs font-semibold text-[#315C0B]">
                  Activa
                </span>
              </div>

              <div className="space-y-3">
                {items.map((item, idx) => (
                  <div key={item.label} className="flex gap-3 rounded-lg border border-[#D7E4ED] bg-[#F7FBFD] p-3">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[6px] bg-[#114E6D] text-sm font-bold text-white">
                      {idx + 1}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-[#0F3C55]">{item.label}</p>
                      <p className="text-xs text-[#657D8F]">{item.copy}</p>
                    </div>
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
