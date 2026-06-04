"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type {
  AuditorDiagnosis,
  AuditorFinding,
  AuditorRepairPlan,
  GitHubIntegrationStatus,
  GitHubRepairPrResult,
} from "@/lib/agents/auditor/types";

type RequestState = "idle" | "loading" | "success" | "error";

type StatusPayload = {
  status: {
    github: GitHubIntegrationStatus;
    rateLimit: {
      sharedStoreConfigured: boolean;
      missing: string[];
      store: string;
    };
    permissions: {
      read: string;
      repair: string;
      currentUserIsOwner: boolean;
    };
  };
};

type RepairPlanPayload = {
  plan: AuditorRepairPlan;
};

type IssuePayload = {
  issue: {
    number: number;
    title: string;
    url: string;
    state: string;
  };
};

type PrPayload = {
  result: GitHubRepairPrResult;
  plan: AuditorRepairPlan;
};

const PANEL_CLASS = "rounded-2xl border border-[color:var(--admin-shell-border)] bg-white p-4 shadow-sm";
const EYEBROW_CLASS = "text-xs font-black uppercase tracking-[0.14em] text-[color:var(--admin-shell-muted)]";
const TITLE_CLASS = "mt-1 text-2xl font-black text-[color:var(--admin-shell-ink)]";
const COPY_CLASS = "mt-1 max-w-3xl text-sm leading-6 text-[color:var(--admin-shell-muted)]";
const SECTION_TITLE_CLASS = "text-base font-black text-[color:var(--admin-shell-ink)]";
const SUCCESS_MESSAGE_CLASS = "rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800";
const ERROR_MESSAGE_CLASS = "rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800";

async function readJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init });
  const payload = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!response.ok) throw new Error(payload?.error ?? "La operacion fallo.");
  return payload as T;
}

function severityChip(severity: AuditorFinding["severity"]) {
  if (severity === "critical" || severity === "error") return "ui-admin-chip ui-admin-chip--danger";
  if (severity === "warning") return "ui-admin-chip ui-admin-chip--warn";
  return "ui-admin-chip ui-admin-chip--success";
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Sin diagnostico";
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function GitHubStatus({ status }: { status: GitHubIntegrationStatus | null }) {
  if (!status) return <span className="ui-admin-chip">GitHub: sincronizando</span>;
  return (
    <span className={status.configured ? "ui-admin-chip ui-admin-chip--success" : "ui-admin-chip ui-admin-chip--warn"}>
      GitHub: {status.configured ? `${status.owner}/${status.repo}` : `faltan ${status.missing.length}`}
    </span>
  );
}

export default function AuditorPanel() {
  const [status, setStatus] = useState<StatusPayload["status"] | null>(null);
  const [diagnosis, setDiagnosis] = useState<AuditorDiagnosis | null>(null);
  const [plans, setPlans] = useState<Record<string, AuditorRepairPlan>>({});
  const [state, setState] = useState<RequestState>("idle");
  const [busyFindingId, setBusyFindingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const findings = useMemo(() => diagnosis?.findings ?? [], [diagnosis?.findings]);
  const repairableCount = useMemo(
    () => findings.filter((finding) => finding.repairable).length,
    [findings],
  );

  const refreshStatus = useCallback(async () => {
    try {
      const next = await readJson<StatusPayload>("/api/agents/auditor/status");
      setStatus(next.status);
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "No se pudo cargar estado.");
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => void refreshStatus(), 0);
    return () => window.clearTimeout(timeout);
  }, [refreshStatus]);

  async function runDiagnosis() {
    setState("loading");
    setMessage(null);
    setPlans({});
    try {
      const next = await readJson<{ diagnosis: AuditorDiagnosis }>("/api/agents/auditor/diagnose", {
        method: "POST",
      });
      setDiagnosis(next.diagnosis);
      setState("success");
      setMessage(`Diagnostico ejecutado: ${next.diagnosis.summary.total} hallazgos.`);
      await refreshStatus();
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "No se pudo ejecutar diagnostico.");
    }
  }

  async function createPlan(finding: AuditorFinding) {
    setBusyFindingId(finding.id);
    setMessage(null);
    try {
      const payload = await readJson<RepairPlanPayload>("/api/agents/auditor/repair-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ finding }),
      });
      setPlans((current) => ({ ...current, [finding.id]: payload.plan }));
      setState("success");
      setMessage(`Plan generado para ${finding.id}.`);
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "No se pudo generar plan.");
    } finally {
      setBusyFindingId(null);
    }
  }

  async function createIssue(finding: AuditorFinding) {
    setBusyFindingId(finding.id);
    setMessage(null);
    try {
      const payload = await readJson<IssuePayload>("/api/agents/auditor/create-github-issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ finding }),
      });
      setState("success");
      setMessage(`Issue creado: #${payload.issue.number}.`);
      window.open(payload.issue.url, "_blank", "noopener,noreferrer");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "No se pudo crear issue.");
    } finally {
      setBusyFindingId(null);
    }
  }

  async function createPr(finding: AuditorFinding) {
    if (!window.confirm(`Crear PR draft para ${finding.id}?`)) return;
    setBusyFindingId(finding.id);
    setMessage(null);
    try {
      const payload = await readJson<PrPayload>("/api/agents/auditor/create-github-pr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ finding, confirmation: "CREATE_REPAIR_PR" }),
      });
      setPlans((current) => ({ ...current, [finding.id]: payload.plan }));
      setState("success");
      setMessage(`PR creado: #${payload.result.pullRequest.number}.`);
      window.open(payload.result.pullRequest.url, "_blank", "noopener,noreferrer");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "No se pudo crear PR.");
    } finally {
      setBusyFindingId(null);
    }
  }

  return (
    <div className="grid gap-4">
      <section className={PANEL_CLASS}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className={EYEBROW_CLASS}>Operaciones</div>
            <h1 className={TITLE_CLASS}>Auditor/Reparador</h1>
            <p className={COPY_CLASS}>
              Diagnostico tecnico de Recalc con trazabilidad y reparaciones via GitHub.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="ui-admin-action ui-admin-action--secondary" type="button" onClick={() => void refreshStatus()} disabled={state === "loading"}>
              Sincronizar
            </button>
            <button className="ui-admin-action" type="button" onClick={() => void runDiagnosis()} disabled={state === "loading"}>
              Ejecutar diagnostico
            </button>
          </div>
        </div>
        {message ? (
          <p className={state === "error" ? `${ERROR_MESSAGE_CLASS} mt-3` : `${SUCCESS_MESSAGE_CLASS} mt-3`}>
            {message}
          </p>
        ) : null}
      </section>

      <section className={PANEL_CLASS}>
        <div className="flex flex-wrap items-center gap-2">
          <GitHubStatus status={status?.github ?? null} />
          <span className={status?.rateLimit.sharedStoreConfigured ? "ui-admin-chip ui-admin-chip--success" : "ui-admin-chip ui-admin-chip--warn"}>
            Rate limit: {status?.rateLimit.store ?? "sincronizando"}
          </span>
          <span className={status?.permissions.currentUserIsOwner ? "ui-admin-chip ui-admin-chip--success" : "ui-admin-chip"}>
            Reparacion: {status?.permissions.currentUserIsOwner ? "owner" : "solo lectura"}
          </span>
          <span className="ui-admin-chip">Ultimo: {formatDate(diagnosis?.generatedAt)}</span>
          <span className="ui-admin-chip">Reparables: {repairableCount}</span>
        </div>
      </section>

      {diagnosis ? (
        <section className={PANEL_CLASS}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className={SECTION_TITLE_CLASS}>Resumen</h2>
              <p className={COPY_CLASS}>
                {diagnosis.summary.total} hallazgos: {diagnosis.summary.critical} critical, {diagnosis.summary.error} error, {diagnosis.summary.warning} warning, {diagnosis.summary.info} info.
              </p>
            </div>
            <span className="ui-admin-chip">Duracion: {diagnosis.durationMs}ms</span>
          </div>
        </section>
      ) : null}

      <section className={PANEL_CLASS}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className={SECTION_TITLE_CLASS}>Hallazgos</h2>
            <p className={COPY_CLASS}>Los resultados no incluyen valores de secretos.</p>
          </div>
        </div>

        {findings.length ? (
          <div className="ui-admin-table-shell mt-4">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr>
                  <th>Severidad</th>
                  <th>Modulo</th>
                  <th>Hallazgo</th>
                  <th>Accion</th>
                </tr>
              </thead>
              <tbody>
                {findings.map((finding) => {
                  const plan = plans[finding.id];
                  const busy = busyFindingId === finding.id;
                  return (
                    <tr key={finding.id}>
                      <td><span className={severityChip(finding.severity)}>{finding.severity}</span></td>
                      <td>{finding.module}</td>
                      <td>
                        <strong>{finding.title}</strong>
                        <p className="mt-1 text-xs text-[color:var(--ui-text-secondary)]">{finding.summary}</p>
                        {plan ? (
                          <p className="mt-1 text-xs text-[color:var(--ui-text-secondary)]">
                            Plan: impacto {plan.impact}, riesgo {plan.risk}, archivos {plan.filesToTouch.length}.
                          </p>
                        ) : null}
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-2">
                          <button className="ui-admin-action ui-admin-action--secondary" type="button" disabled={busy} onClick={() => void createPlan(finding)}>
                            Plan
                          </button>
                          <button className="ui-admin-action ui-admin-action--secondary" type="button" disabled={busy || !status?.permissions.currentUserIsOwner} onClick={() => void createIssue(finding)}>
                            Issue
                          </button>
                          <button className="ui-admin-action" type="button" disabled={busy || !finding.repairable || !status?.permissions.currentUserIsOwner} onClick={() => void createPr(finding)}>
                            PR
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className={COPY_CLASS}>{state === "loading" ? "Ejecutando diagnostico..." : "Ejecuta diagnostico para cargar hallazgos."}</p>
        )}
      </section>
    </div>
  );
}
