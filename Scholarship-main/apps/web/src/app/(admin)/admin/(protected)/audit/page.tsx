import { AdminCapability } from "@prisma/client";

import { getAdminConfigModuleMeta } from "@/lib/admin-config-modules";
import { listAdminAuditLog } from "@/lib/admin-audit";
import { requireAdminCapabilityUser } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function formatDate(value: Date | null) {
  if (!value) return "—";
  return value.toLocaleString("es-MX");
}

export default async function AuditPage() {
  await requireAdminCapabilityUser(AdminCapability.view_admin_operations);
  await requireAdminCapabilityUser(AdminCapability.view_reports);
  const [logs, versions] = await Promise.all([
    listAdminAuditLog({ limit: 120 }),
    prisma.adminConfigVersion.findMany({
      orderBy: [{ createdAt: "desc" }],
      take: 40,
      select: {
        id: true,
        module: true,
        createdAt: true,
        createdByEmail: true,
        publishedAt: true,
        publishedByEmail: true,
        notes: true,
      },
    }),
  ]);

  return (
    <div className="grid gap-6 p-6">
      <section className="ui-card ui-card-pad">
        <div className="text-xs uppercase tracking-[0.28em] text-slate-400">Auditoría</div>
        <h1 className="mt-1 text-xl font-semibold">Historial de cambios críticos</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-300">
          Cada acción relevante de admin queda registrada con módulo, actor y snapshot before/after.
        </p>
      </section>

      <section className="ui-card ui-card-pad">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.28em] text-slate-400">
              Audit log
            </div>
            <h2 className="mt-1 text-lg font-semibold">Eventos recientes</h2>
          </div>
          <div className="text-sm text-slate-400">{logs.length} registros</div>
        </div>

        <div className="mt-5 overflow-auto rounded-2xl border border-white/10">
          <table className="w-full min-w-[880px] border-collapse text-sm">
            <thead className="bg-slate-950/40 text-slate-300">
              <tr>
                <th className="p-3 text-left font-semibold">Fecha</th>
                <th className="p-3 text-left font-semibold">Módulo</th>
                <th className="p-3 text-left font-semibold">Acción</th>
                <th className="p-3 text-left font-semibold">Actor</th>
                <th className="p-3 text-left font-semibold">Entidad</th>
                <th className="p-3 text-left font-semibold">Detalle</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-t border-white/10">
                  <td className="p-3 text-slate-300">{formatDate(log.createdAt)}</td>
                  <td className="p-3 text-slate-100">
                    {getAdminConfigModuleMeta(log.module).label}
                  </td>
                  <td className="p-3 text-slate-200">{log.action}</td>
                  <td className="p-3 text-slate-300">{log.actorEmail ?? "—"}</td>
                  <td className="p-3 text-slate-300">
                    {log.entityType ?? "—"}
                    {log.entityId ? (
                      <div className="text-xs text-slate-500">{log.entityId.slice(0, 8)}</div>
                    ) : null}
                  </td>
                  <td className="p-3 text-slate-400">{log.message ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="ui-card ui-card-pad">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.28em] text-slate-400">
              Versiones
            </div>
            <h2 className="mt-1 text-lg font-semibold">Snapshots publicados</h2>
          </div>
          <div className="text-sm text-slate-400">{versions.length} versiones</div>
        </div>

        <div className="mt-5 overflow-auto rounded-2xl border border-white/10">
          <table className="w-full min-w-[820px] border-collapse text-sm">
            <thead className="bg-slate-950/40 text-slate-300">
              <tr>
                <th className="p-3 text-left font-semibold">Versión</th>
                <th className="p-3 text-left font-semibold">Módulo</th>
                <th className="p-3 text-left font-semibold">Creada</th>
                <th className="p-3 text-left font-semibold">Creada por</th>
                <th className="p-3 text-left font-semibold">Publicada</th>
                <th className="p-3 text-left font-semibold">Notas</th>
              </tr>
            </thead>
            <tbody>
              {versions.map((version) => (
                <tr key={version.id} className="border-t border-white/10">
                  <td className="p-3 text-slate-100">{version.id.slice(0, 8)}</td>
                  <td className="p-3 text-slate-300">
                    {getAdminConfigModuleMeta(version.module).label}
                  </td>
                  <td className="p-3 text-slate-300">{formatDate(version.createdAt)}</td>
                  <td className="p-3 text-slate-300">{version.createdByEmail ?? "—"}</td>
                  <td className="p-3 text-slate-300">
                    {formatDate(version.publishedAt)}
                    {version.publishedByEmail ? (
                      <div className="text-xs text-slate-500">{version.publishedByEmail}</div>
                    ) : null}
                  </td>
                  <td className="p-3 text-slate-400">{version.notes ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
