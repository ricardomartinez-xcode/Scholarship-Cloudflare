import Image from "next/image";
import Link from "next/link";

export default function PublicHero() {
  return (
    <section className="relative overflow-hidden border-b border-[rgba(17,78,109,0.12)] bg-[#F4F9FC] py-14 sm:py-20 lg:py-24">
      <div className="relative z-10 mx-auto max-w-6xl px-[var(--ui-shell-pad-x)]">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.02fr)_minmax(360px,0.98fr)] lg:items-center">
          <div className="grid gap-7">
            <Image
              src="/branding/logo-unidep.png"
              alt="UNIDEP"
              width={260}
              height={78}
              className="h-12 w-auto object-contain sm:h-14"
              priority
            />

            <div className="space-y-4">
              <h1 className="max-w-3xl text-4xl font-bold tracking-normal text-[#0F3C55] sm:text-5xl lg:text-6xl">
                ReCalc UNIDEP
              </h1>
              <p className="max-w-2xl text-xl font-semibold leading-snug text-[#114E6D] sm:text-2xl">
                Becas, seguimiento comercial y capacitación en una experiencia clara.
              </p>
            </div>

            <p className="max-w-xl text-xl leading-relaxed text-[#4f6b81]">
              Calcula una beca personalizada, continúa tu solicitud y accede a
              herramientas de apoyo sin perder el contexto del proceso.
            </p>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/auth/sign-up"
                className="rounded-[7px] bg-[#114E6D] px-7 py-3 font-semibold text-white transition hover:bg-[#0F3C55] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(17,78,109,0.24)]"
              >
                Crear cuenta
              </Link>
              <Link
                href="/auth/sign-in"
                className="rounded-[7px] border border-[#D7E4ED] bg-white px-7 py-3 font-semibold text-[#0F3C55] transition hover:bg-[#F7FBFD] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(17,78,109,0.18)]"
              >
                Iniciar sesión
              </Link>
            </div>

            <div className="flex flex-wrap items-center gap-5 border-t border-[rgba(17,78,109,0.12)] pt-5">
              <div className="text-sm">
                <p className="font-semibold text-[#0F3C55]">Datos protegidos</p>
                <p className="text-[#6e8599]">Seguro</p>
              </div>
              <div className="h-8 w-px bg-[rgba(17,78,109,0.12)]" aria-hidden="true" />
              <div className="text-sm">
                <p className="font-semibold text-[#0F3C55]">24/7</p>
                <p className="text-[#6e8599]">Disponible</p>
              </div>
              <div className="h-8 w-px bg-[rgba(17,78,109,0.12)]" aria-hidden="true" />
              <div className="text-sm">
                <p className="font-semibold text-[#0F3C55]">Acceso único</p>
                <p className="text-[#6e8599]">Una sesión</p>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="rounded-lg border border-[#D7E4ED] bg-white p-5 shadow-[0_22px_50px_rgba(18,51,72,0.1)]">
              <div className="mb-5 flex items-center justify-between border-b border-[#D7E4ED] pb-4">
                <div>
                  <p className="text-sm font-semibold text-[#0F3C55]">Panel ReCalc</p>
                  <p className="text-xs text-[#657D8F]">Solicitud activa</p>
                </div>
                <span className="rounded-[6px] bg-[#EDF7E2] px-2.5 py-1 text-xs font-semibold text-[#315C0B]">
                  En proceso
                </span>
              </div>

              <div className="grid gap-3">
                {[
                  ["Beca estimada", "72%", "#6CB514"],
                  ["Documentos", "4 de 5", "#114E6D"],
                  ["Seguimiento", "Cita agendada", "#114E6D"],
                ].map(([label, value, color]) => (
                  <div
                    key={label}
                    className="flex items-center justify-between rounded-lg border border-[#D7E4ED] bg-[#F7FBFD] p-4"
                  >
                    <span className="text-sm font-medium text-[#365770]">{label}</span>
                    <span className="text-sm font-bold" style={{ color }}>
                      {value}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-5 rounded-lg bg-[#114E6D] p-4 text-white">
                <p className="text-sm font-semibold">Siguiente paso</p>
                <p className="mt-1 text-sm text-white/78">
                  Revisar datos academicos y continuar con asesoria.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
