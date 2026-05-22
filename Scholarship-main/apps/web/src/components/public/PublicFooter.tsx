import Link from "next/link";

import { RecalcFullLogo } from "@/components/ui/BrandLogos";

export default function PublicFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-[rgba(23,56,95,0.12)] bg-[#17385F] text-white">
      <div className="mx-auto max-w-6xl px-[var(--ui-shell-pad-x)] py-12 sm:py-16">
        <div className="grid md:grid-cols-4 gap-8 mb-12">
          <div className="space-y-4">
            <RecalcFullLogo
              className="h-12 w-auto max-w-[220px]"
              sizes="220px"
            />
            <p className="text-sm text-slate-200/72">
              Plataforma oficial de ReLead para becas, operación comercial y
              capacitación, implementada en colaboración con UNIDEP.
            </p>
          </div>

          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-white">Producto</h4>
            <ul className="space-y-2">
              <li>
                <Link href="/#beneficios" className="text-sm text-slate-200/72 transition hover:text-white">
                  Características
                </Link>
              </li>
              <li>
                <Link href="/#capacitacion" className="text-sm text-slate-200/72 transition hover:text-white">
                  Capacitación
                </Link>
              </li>
              <li>
                <Link href="/auth/sign-up" className="text-sm text-slate-200/72 transition hover:text-white">
                  Registrarse
                </Link>
              </li>
            </ul>
          </div>

          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-white">Legal</h4>
            <ul className="space-y-2">
              <li>
                <Link href="/legal/privacy" className="text-sm text-slate-200/72 transition hover:text-white">
                  Privacidad
                </Link>
              </li>
              <li>
                <Link href="/legal/terms" className="text-sm text-slate-200/72 transition hover:text-white">
                  Términos
                </Link>
              </li>
              <li>
                <a href="mailto:soporte@relead.com.mx" className="text-sm text-slate-200/72 transition hover:text-white">
                  Soporte
                </a>
              </li>
            </ul>
          </div>

          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-white">Contacto</h4>
            <ul className="space-y-2">
              <li>
                <a href="https://relead.com.mx" target="_blank" rel="noopener noreferrer" className="text-sm text-slate-200/72 transition hover:text-white">
                  ReLead.com.mx
                </a>
              </li>
              <li>
                <a href="mailto:info@relead.com.mx" className="text-sm text-slate-200/72 transition hover:text-white">
                  info@relead.com.mx
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="flex flex-col items-center justify-between gap-4 border-t border-white/8 pt-8 sm:flex-row">
          <p className="text-xs text-slate-200/60">
            © {currentYear} ReLead. Todos los derechos reservados. ReCalc opera en colaboración con UNIDEP.
          </p>
          <p className="text-xs text-slate-200/50">
            Desarrollado por ReLead
          </p>
        </div>
      </div>
    </footer>
  );
}
