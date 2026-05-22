import Link from "next/link";

import { RecalcIconLogo, UnidepLogo } from "@/components/ui/BrandLogos";

export default function PublicHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-[#D7E4ED] bg-white/95 text-[#0F3C55] shadow-[0_10px_28px_rgba(18,51,72,0.08)] backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-[var(--ui-shell-pad-x)] py-4 sm:py-5">
        <Link
          href="/"
          className="flex items-center gap-3 rounded-lg p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(17,78,109,0.2)]"
        >
          <UnidepLogo
            className="h-8 w-auto sm:h-9"
            priority
            sizes="(max-width: 640px) 128px, 172px"
          />
          <span className="h-7 w-px bg-[#D7E4ED]" aria-hidden="true" />
          <RecalcIconLogo
            className="h-8 w-8 sm:h-9 sm:w-9"
            priority
            sizes="36px"
          />
          <span className="sr-only">ReCalc</span>
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          <Link href="/#beneficios" className="text-sm font-medium text-[#657D8F] transition hover:text-[#0F3C55]">
            Beneficios
          </Link>
          <Link href="/#capacitacion" className="text-sm font-medium text-[#657D8F] transition hover:text-[#0F3C55]">
            Capacitación
          </Link>
          <Link href="/legal/privacy" className="text-sm font-medium text-[#657D8F] transition hover:text-[#0F3C55]">
            Ayuda
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/auth/sign-in"
            className="rounded-[7px] px-4 py-2 text-sm font-semibold text-[#0F3C55] transition hover:bg-[#F4F9FC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(17,78,109,0.18)]"
          >
            Ingresar
          </Link>
          <Link
            href="/auth/sign-up"
            className="rounded-[7px] bg-[#114E6D] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#0F3C55] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(17,78,109,0.22)]"
          >
            Crear cuenta
          </Link>
        </div>
      </div>
    </header>
  );
}
