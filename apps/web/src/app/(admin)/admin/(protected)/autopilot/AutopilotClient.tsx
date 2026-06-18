"use client";

import { useEffect, useMemo, useState } from "react";

import AdminDataTable from "@/components/admin/AdminDataTable";

type AutoAuditFindingView = {
  id: string;
  checkId: string;
  severity: string;
  domain: string;
  title: string;
  message: string;
  filePath: string | null;
  line: number | null;
  suggestedAction: string | null;
  repairable: boolean;
};

type AutoRepairRunView = {
  id: string;
  auditRunId: string;
  status: string;
  branchName: string;
  pullRequestUrl: string | null;
  createdAt: string;
};

type AutoAuditRunView = {
  id: string;
  status: string;
  mode: string;
  ref: string;
  workflowRunUrl: string | null;
  reportSummary: unknown;
  error: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  findings: AutoAuditFindingView[];
  repairs: AutoRepairRunView[];
};

type ApiPayload<T> = T & {
  ok: boolean;
  error?: string;
  message?: string;
};

async function fetchJson<T>(url: string, init?: RequestInit): Promise<ApiPayload<T>> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const payload = (await response.json().catch(() => null)) as ApiPayload<T> | null;
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error || payload?.message || "Solicitud fallida.");
  }
  return payload;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Pendiente";
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function statusClass(status: string) {
  if (status === "ready" || status === "no_changes") {
    return "border-emerald-700/20 bg-emerald-50 text-emerald-800";
  }
  if (status === "failed") return "border-red-700/20 bg-red-50 text-red-800";
  if (status === "cancelled") return "border-slate-500/20 bg-slate-100 text-slate-700";
  return "border-amber-700/20 bg-amber-50 text-amber-800";
}

function severityClass(severity: string) {
  if (severity === "P0") return "border-red-700/20 bg-red-50 text-red-800";
  if (severity === "P1") return "border-amber-700/20 bg-amber-50 text-amber-800";
  return "border-sky-700/20 bg-sky-50 text-sky-800";
}

function pill(className: string, label: string) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-extrabold ${className}`}>
      {label}
    </span>
  );
}

export default function AutopilotClient({
  initialAudits,
  initialRepairs,
  canRepair,
}: {
  initialAudits: AutoAuditRunView[];
  initialRepairs: AutoRepairRunView[];
  canRepair: boolean;
}) {
  const [audits, setAudits] = useState(initialAudits);
  const [repairs, setRepairs] = useState(initialRepairs);
  const [selectedAuditId, setSelectedAuditId] = useState(initialAudits[0]?.id ?? "");
  const [operation, setOperation] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedAudit = useMemo(
    () => audits.find((audit) => audit.id === selectedAuditId) ?? audits[0] ?? null,
    [audits, selectedAuditId],
  );
  const repairableFindingIds = useMemo(
    () =>
      selectedAudit?.findings
        .filter((finding) => finding.repairable)
        .map((finding) => finding.id) ?? [],
    [selectedAudit],
  );
  const activeAuditCount = audits.filter((audit) =>
    ["queued", "running"].includes(audit.status),
  ).length;

  async function refreshAudits() {
    const payload = await fetchJson<{ audits: AutoAuditRunView[] }>(
      "/api/admin/autopilot/audits",
    );
    setAudits(payload.audits);
    if (!selectedAuditId && payload.audits[0]) setSelectedAuditId(payload.audits[0].id);
  }

  async function runAudit() {
    setOperation("audit");
    setError(null);
    try {
      const payload = await fetchJson<{ audit: AutoAuditRunView }>(
        "/api/admin/autopilot/audits",
        {
          method: "POST",
          body: JSON.stringify({ mode: "standard" }),
        },
      );
      setAudits((current) => [payload.audit, ...current.filter((audit) => audit.id !== payload.audit.id)]);
      setSelectedAuditId(payload.audit.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setOperation(null);
    }
  }

  async function syncAudit(auditId: string) {
    setOperation(`sync:${auditId}`);
    setError(null);
    try {
      const payload = await fetchJson<{ audit: AutoAuditRunView; synced: boolean }>(
        `/api/admin/autopilot/audits/${auditId}/sync`,
        { method: "POST", body: "{}" },
      );
      setAudits((current) =>
        current.map((audit) => (audit.id === payload.audit.id ? payload.audit : audit)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setOperation(null);
    }
  }

  async function createRepairPr() {
    if (!selectedAudit || !repairableFindingIds.length) return;
    setOperation("repair");
    setError(null);
    try {
      const payload = await fetchJson<{ repair: AutoRepairRunView }>(
        "/api/admin/autopilot/repairs",
        {
          method: "POST",
          body: JSON.stringify({
            auditRunId: selectedAudit.id,
            findingIds: repairableFindingIds,
          }),
        },
      );
      setRepairs((current) => [
        payload.repair,
        ...current.filter((repair) => repair.id !== payload.repair.id),
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setOperation(null);
    }
  }

  useEffect(() => {
    if (!activeAuditCount) return;
    const timer = window.setInterval(() => {
      const active = audits.filter((audit) => ["queued", "running"].includes(audit.status));
      void Promise.all(active.slice(0, 3).map((audit) => syncAudit(audit.id)));
    }, 12000);
    return () => window.clearInterval(timer);
  }, [activeAuditCount, audits]);

  return (
    <div className="grid gap-5 p-4 sm:p-5 lg:p-6">
      <section className="rounded-[20px] border border-[#c8d6e2] bg-white p-5 shadow-[0_16px_46px_rgb(16_32_42/0.06)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[0.68rem] font-extrabold uppercase tracking-[0.18em] text-[#536a7c]">
              Sistema interno
            </div>
            <h1 className="mt-1 text-2xl font-black tracking-[-0.04em] text-[#102838]">
              Autopilot
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void refreshAudits()}
              className="inline-flex min-h-10 items-center justify-center rounded-full border border-[#0f4c6b] bg-white px-4 text-sm font-extrabold text-[#0f4c6b] transition hover:bg-[#e9f3f8]"
            >
              Refresh
            </button>
            <button
              type="button"
              onClick={() => void runAudit()}
              disabled={operation === "audit"}
              className="inline-flex min-h-10 items-center justify-center rounded-full border border-[#0f4c6b] bg-[#0f4c6b] px-4 text-sm font-extrabold text-white transition hover:bg-[#0b3d56] disabled:cursor-not-allowed disabled:opacity-60"
            >
              Run audit
            </button>
          </div>
        </div>
        {error ? (
          <div className="mt-4 rounded-[16px] border border-red-700/20 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
            {error}
          </div>
        ) : null}
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.78fr)]">
        <AdminDataTable title="Auditorías" count={audits.length} maxHeight="560px">
          <table>
            <thead>
              <tr>
                <th>Run</th>
                <th>Status</th>
                <th>Modo</th>
                <th>Findings</th>
                <th>Creada</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {audits.map((audit) => (
                <tr key={audit.id} className={audit.id === selectedAudit?.id ? "bg-[#eef6fa]" : ""}>
                  <td>
                    <button
                      type="button"
                      onClick={() => setSelectedAuditId(audit.id)}
                      className="max-w-[210px] truncate text-left font-extrabold text-[#0f4c6b]"
                      title={audit.id}
                    >
                      {audit.id}
                    </button>
                    <div className="mt-1 text-xs font-semibold text-[#536a7c]">{audit.ref}</div>
                  </td>
                  <td>{pill(statusClass(audit.status), audit.status)}</td>
                  <td>{audit.mode}</td>
                  <td>{audit.findings.length}</td>
                  <td>{formatDate(audit.createdAt)}</td>
                  <td>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void syncAudit(audit.id)}
                        disabled={operation === `sync:${audit.id}`}
                        className="inline-flex min-h-8 items-center justify-center rounded-full border border-[#0f4c6b]/30 px-3 text-xs font-extrabold text-[#0f4c6b] disabled:opacity-60"
                      >
                        Sync
                      </button>
                      {audit.workflowRunUrl ? (
                        <a
                          href={audit.workflowRunUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex min-h-8 items-center justify-center rounded-full border border-[#0f4c6b]/30 px-3 text-xs font-extrabold text-[#0f4c6b]"
                        >
                          Logs
                        </a>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
              {!audits.length ? (
                <tr>
                  <td colSpan={6}>
                    <div className="rounded-[16px] border border-dashed border-[#c8d6e2] bg-[#f7fafc] px-4 py-5 text-sm text-[#536a7c]">
                      Sin auditorías registradas.
                    </div>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </AdminDataTable>

        <section className="rounded-[20px] border border-[#c8d6e2] bg-white p-4 shadow-[0_12px_34px_rgb(16_32_42/0.05)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-black text-[#102838]">Repair PR</h2>
              <div className="mt-1 text-sm font-semibold text-[#536a7c]">
                {repairableFindingIds.length} reparación(es) disponible(s)
              </div>
            </div>
            <button
              type="button"
              onClick={() => void createRepairPr()}
              disabled={!canRepair || !repairableFindingIds.length || operation === "repair"}
              className="inline-flex min-h-10 items-center justify-center rounded-full border border-[#0f4c6b] bg-[#0f4c6b] px-4 text-sm font-extrabold text-white transition hover:bg-[#0b3d56] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Create repair PR
            </button>
          </div>

          <div className="mt-4 grid gap-2">
            {repairs.slice(0, 6).map((repair) => (
              <div
                key={repair.id}
                className="rounded-[16px] border border-[#d8e4ec] bg-[#f7fafc] px-3 py-3 text-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate font-extrabold text-[#163247]">
                    {repair.branchName}
                  </span>
                  {pill(statusClass(repair.status), repair.status)}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-semibold text-[#536a7c]">
                  <span>{formatDate(repair.createdAt)}</span>
                  {repair.pullRequestUrl ? (
                    <a
                      href={repair.pullRequestUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-extrabold text-[#0f4c6b]"
                    >
                      PR
                    </a>
                  ) : null}
                </div>
              </div>
            ))}
            {!repairs.length ? (
              <div className="rounded-[16px] border border-dashed border-[#c8d6e2] bg-[#f7fafc] px-4 py-5 text-sm text-[#536a7c]">
                Sin reparaciones registradas.
              </div>
            ) : null}
          </div>
        </section>
      </section>

      <AdminDataTable
        title={selectedAudit ? `Findings ${selectedAudit.id}` : "Findings"}
        count={selectedAudit?.findings.length ?? 0}
        maxHeight="620px"
      >
        <table>
          <thead>
            <tr>
              <th>Sev</th>
              <th>Dominio</th>
              <th>Hallazgo</th>
              <th>Archivo</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {selectedAudit?.findings.map((finding) => (
              <tr key={finding.id}>
                <td>{pill(severityClass(finding.severity), finding.severity)}</td>
                <td>{finding.domain}</td>
                <td>
                  <div className="max-w-[520px] whitespace-normal">
                    <div className="font-extrabold text-[#163247]">{finding.title}</div>
                    <div className="mt-1 text-xs leading-5 text-[#536a7c]">{finding.message}</div>
                  </div>
                </td>
                <td>
                  <span className="block max-w-[360px] truncate" title={finding.filePath ?? ""}>
                    {finding.filePath ?? "repo"}
                    {finding.line ? `:${finding.line}` : ""}
                  </span>
                </td>
                <td>
                  <div className="max-w-[420px] whitespace-normal text-xs font-semibold text-[#536a7c]">
                    {finding.suggestedAction ?? "Revisión manual"}
                  </div>
                </td>
              </tr>
            ))}
            {selectedAudit && !selectedAudit.findings.length ? (
              <tr>
                <td colSpan={5}>
                  <div className="rounded-[16px] border border-dashed border-[#c8d6e2] bg-[#f7fafc] px-4 py-5 text-sm text-[#536a7c]">
                    Sin hallazgos en esta auditoría.
                  </div>
                </td>
              </tr>
            ) : null}
            {!selectedAudit ? (
              <tr>
                <td colSpan={5}>
                  <div className="rounded-[16px] border border-dashed border-[#c8d6e2] bg-[#f7fafc] px-4 py-5 text-sm text-[#536a7c]">
                    Selecciona o crea una auditoría.
                  </div>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </AdminDataTable>
    </div>
  );
}
