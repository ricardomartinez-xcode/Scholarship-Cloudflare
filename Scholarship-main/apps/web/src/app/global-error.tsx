"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="es">
      <body className="min-h-screen bg-[#F2F7FB] text-[#17385F]">
        <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-6 px-6 text-center">
          <div className="space-y-3">
            <div className="text-xs uppercase tracking-[0.3em] text-[#6e8599]">
              Error global
            </div>
            <h1 className="text-3xl font-semibold">La aplicación encontró un error inesperado</h1>
            <p className="text-sm text-[#4f6b81]">
              El evento quedó registrado para diagnóstico. Intenta recargar la vista o vuelve a iniciar el flujo.
            </p>
          </div>
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-2xl bg-[#1F6C8C] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#0F3C55]"
          >
            Reintentar
          </button>
        </main>
      </body>
    </html>
  );
}
