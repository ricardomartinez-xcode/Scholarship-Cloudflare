import type { ReactNode } from "react";

import Link from "next/link";

export default function ImportacionesLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid gap-4">
      <nav className="mx-6 mt-6 flex flex-wrap items-center gap-2 rounded-3xl border border-white/10 bg-slate-950/35 p-2 text-sm">
        <Link
          href="/admin/importaciones"
          className="rounded-2xl border border-white/10 px-4 py-2 font-semibold text-slate-200 transition hover:bg-white/10"
        >
          Historial
        </Link>
        <Link
          href="/admin/importaciones/plantillas"
          className="rounded-2xl border border-white/10 px-4 py-2 font-semibold text-slate-200 transition hover:bg-white/10"
        >
          Plantillas descargables
        </Link>
        <Link
          href="/admin/importaciones/flujo-publicacion"
          className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 font-semibold text-cyan-100 transition hover:bg-cyan-500/20"
        >
          Flujo borrador/publicación
        </Link>
      </nav>
      {children}
    </div>
  );
}
