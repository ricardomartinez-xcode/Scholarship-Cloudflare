import Link from "next/link";

import { requireAdminAccessUser } from "@/lib/admin-session";
import { getSmtpStatus } from "@/lib/smtp";

export const dynamic = "force-dynamic";

export default async function NeonAuthIntegrationPage() {
  await requireAdminAccessUser();
  const smtp = getSmtpStatus();

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">Modo legado activo</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-950">Neon Auth por invitacion</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
          Las integraciones nuevas de OAuth providers, webhooks reenviados, Meta, Google y WhatsApp estan deshabilitadas temporalmente.
          El flujo activo vuelve a ser: crear invitacion, enviar correo o copiar link, y completar la cuenta via Neon Auth.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <p className="text-sm font-semibold text-emerald-900">Invitaciones</p>
          <p className="mt-2 text-sm text-emerald-800">Activas por correo y link manual.</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm font-semibold text-slate-900">SMTP</p>
          <p className="mt-2 text-sm text-slate-600">{smtp.ok ? "Configurado para envio de correos." : `Pendiente: ${smtp.missing.join(", ")}`}</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <p className="text-sm font-semibold text-amber-900">Integraciones nuevas</p>
          <p className="mt-2 text-sm text-amber-800">Deshabilitadas temporalmente por seguridad operativa.</p>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">Flujo recomendado</h2>
        <ol className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
          <li>1. Crea o reenvia una invitacion desde el modulo de Invitaciones.</li>
          <li>2. Usa envio por correo si SMTP esta activo, o copia el link de invitacion.</li>
          <li>3. El usuario completa su alta con Neon Auth desde el link recibido.</li>
        </ol>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/admin/invitations" className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
            Ir a invitaciones
          </Link>
          <Link href="/admin/users" className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Ver usuarios
          </Link>
        </div>
      </div>
    </section>
  );
}
