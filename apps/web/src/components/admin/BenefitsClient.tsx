"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import AdminSegmentedTabs from "@/components/admin/AdminSegmentedTabs";
import AdminDialogShell from "@/components/admin/AdminDialogShell";
import { useAdminActionForm } from "@/components/admin/useAdminActionForm";
import SmartMultiSelect from "@/components/SmartMultiSelect";
import SmartSelect from "@/components/SmartSelect";
import AppSelect from "@/components/ui/AppSelect";
import {
  compareAdminPricingScope,
  formatAdminPricingTier,
  normalizeAdminPricingRegion,
} from "@/lib/admin-pricing-display";
import {
  BASE_SCHOLARSHIP_AVERAGE_RANGES,
  findBaseScholarshipAverageRange,
  resolveBaseScholarshipAverageRange,
} from "@/lib/admin-base-scholarships";

type Benefit = {
  id: string;
  appliesToAll: boolean;
  campusIds: string[];
  campusScopes: Array<{ id: string; name: string; kind: string; tier?: string | null }>;
  campusNames: string[];
  benefitType: "percentage" | "first_payment";
  enrollmentType: "nuevo_ingreso" | "regreso" | "reingreso" | null;
  extraPercent: number;
  firstPaymentAmount: number;
  isActive: boolean;
  notes: string | null;
  businessLine: string | null;
  modality: string | null;
  duration: string | null;
};

type BaseScholarshipRow = {
  id: string;
  enrollmentType: string;
  businessLine: string;
  modality: string;
  plan: number;
  campusTier: string;
  percentages: number[];
  ranges: string[];
  ruleCount: number;
  rules: BaseScholarshipRuleRow[];
};

type BaseScholarshipRuleRow = {
  id: string;
  minAverage: number | null;
  maxAverage: number | null;
  scholarshipPercent: number | null;
  rangeLabel: string;
};

type ActionResult = { ok: boolean; error?: string };

type BaseScholarshipImportPreviewRow = {
  rowNumber: number;
  action: "create" | "update" | "noop";
  region: string | null;
  plantel: string | null;
  tier: string;
  enrollmentType: "nuevo_ingreso" | "regreso" | "reingreso";
  businessLine: string;
  modality: string;
  plan: number;
  minAverage: number;
  maxAverage: number;
  scholarshipPercent: number;
  notes: string | null;
};

type BenefitImportPreviewRow = {
  rowNumber: number;
  action: "create" | "update" | "noop";
  region?: string | null;
  tier?: string | null;
  benefitType: "percentage" | "first_payment";
  enrollmentType: "nuevo_ingreso" | "regreso" | "reingreso" | null;
  businessLine: string | null;
  modality: string | null;
  duration: string | null;
  appliesToAll: boolean;
  campusIds: string[];
  campusLabels?: string[];
  extraPercent: number;
  firstPaymentAmount: number;
  isActive: boolean;
  notes: string | null;
};

type BenefitImportSummary = {
  ok: true;
  sessionId: string;
  processed: number;
  ready: number;
  created: number;
  updated: number;
  unchanged: number;
  warnings: string[];
  errors: string[];
  previewRows?: BenefitImportPreviewRow[];
  applied?: boolean;
  rolledBack?: boolean;
};

type BaseScholarshipImportSummary = Omit<BenefitImportSummary, "previewRows"> & {
  previewRows?: BaseScholarshipImportPreviewRow[];
};

type ApiError = {
  ok: false;
  error: string;
  details?: { errors?: unknown } | null;
};

type BenefitsPanel = "benefits" | "base" | "imports";

const BASE_SCHOLARSHIP_TEMPLATE_CSV = [
  "linea,region,plantel,tier,porcentaje,ingreso,modalidad,plan,promedio",
  "Licenciatura,CDMX,Plantel Centro,T1,15,Nuevo Ingreso,Escolarizada,9,7-7.9",
  "Licenciatura Online,Online,Online,,55,Reingreso,Online,11,9-10",
  "Bachillerato Escolarizado,CDMX,Plantel Norte,T2,20,Regreso,Presencial,6,8-8.9",
].join("\n");

const BUSINESS_LINE_OPTIONS = [
  { value: "__ALL__", label: "Todas" },
  { value: "salud", label: "Salud" },
  { value: "licenciatura", label: "Licenciatura" },
  { value: "prepa", label: "Preparatoria" },
  { value: "posgrado", label: "Posgrado" },
];

const MODALITY_OPTIONS = [
  { value: "__ALL__", label: "Todas" },
  { value: "presencial", label: "Presencial" },
  { value: "mixta", label: "Mixta" },
  { value: "online", label: "Online" },
];

const DURATION_OPTIONS = [
  { value: "__ALL__", label: "Cualquiera" },
  { value: "primer_cuatrimestre", label: "Primer cuatrimestre" },
  { value: "toda_la_carrera", label: "Toda la carrera" },
  { value: "pago_inicial", label: "Pago inicial" },
];

const BENEFIT_TYPE_OPTIONS = [
  { value: "percentage", label: "Porcentaje adicional" },
  { value: "first_payment", label: "Primer pago" },
];

const ENROLLMENT_TYPE_OPTIONS = [
  { value: "__ALL__", label: "Cualquier ingreso" },
  { value: "nuevo_ingreso", label: "Nuevo ingreso" },
  { value: "regreso", label: "Regreso" },
  { value: "reingreso", label: "Reingreso" },
];

function resolveLabel(
  value: string | null,
  options: { value: string; label: string }[],
  fallback: string,
) {
  return options.find((option) => option.value === value)?.label ?? fallback;
}

function formatBenefitValue(benefit: Benefit) {
  if (benefit.benefitType === "first_payment") {
    return benefit.firstPaymentAmount.toLocaleString("es-MX", {
      style: "currency",
      currency: "MXN",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  return `${benefit.extraPercent}%`;
}

function benefitScope(benefit: Benefit) {
  const firstCampus = benefit.campusScopes?.[0] ?? null;
  return {
    region: "General",
    plantel: benefit.appliesToAll
      ? "Todos"
      : firstCampus?.name ?? benefit.campusNames?.[0] ?? "Sin planteles",
    tier: benefit.appliesToAll ? "ANY" : firstCampus?.tier ?? null,
    kind: firstCampus?.kind ?? null,
    value: `${benefit.benefitType}:${formatBenefitValue(benefit)}`,
  };
}

function benefitPlantelLabel(benefit: Benefit) {
  if (benefit.appliesToAll) return "Todos";
  if (!benefit.campusNames?.length) return "Sin planteles";
  return benefit.campusNames.join(", ");
}

function benefitTierLabel(benefit: Benefit) {
  if (benefit.appliesToAll) return "General";
  const tiers = Array.from(
    new Set(
      (benefit.campusScopes ?? []).map((campus) =>
        formatAdminPricingTier({
          plantel: campus.name,
          tier: campus.tier,
          kind: campus.kind,
        }),
      ),
    ),
  );
  return tiers.length ? tiers.join(", ") : "General";
}

function benefitPreviewPlantelLabel(row: BenefitImportPreviewRow) {
  if (row.appliesToAll) return "Todos";
  if (row.campusLabels?.length) return row.campusLabels.join(", ");
  if (row.campusIds.length) return row.campusIds.join(", ");
  return "Sin planteles";
}

function compareBusinessLine(
  left: string | null,
  right: string | null,
) {
  const leftLabel = resolveLabel(left, BUSINESS_LINE_OPTIONS, "Todas");
  const rightLabel = resolveLabel(right, BUSINESS_LINE_OPTIONS, "Todas");
  return leftLabel.localeCompare(rightLabel, "es-MX", { sensitivity: "base" });
}

function apiErrorDetails(payload: ApiError) {
  return Array.isArray(payload.details?.errors)
    ? payload.details.errors.map((error) => String(error))
    : [];
}

function downloadCsvTemplate(fileName: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function BenefitsClient({
  benefits,
  baseScholarships,
  campusOptions,
  upsertBenefitAction,
  upsertBaseScholarshipAction,
  deleteBaseScholarshipAction,
  deleteBenefitAction,
}: {
  benefits: Benefit[];
  baseScholarships: BaseScholarshipRow[];
  campusOptions: { value: string; label: string; kind: string; tier?: string | null }[];
  upsertBenefitAction: (formData: FormData) => Promise<ActionResult>;
  upsertBaseScholarshipAction: (formData: FormData) => Promise<ActionResult>;
  deleteBaseScholarshipAction: (formData: FormData) => Promise<void>;
  deleteBenefitAction: (formData: FormData) => Promise<void>;
}) {
  const router = useRouter();
  const importFileRef = useRef<HTMLInputElement | null>(null);
  const baseScholarshipImportFileRef = useRef<HTMLInputElement | null>(null);
  const labelId = useId();
  const percentId = useId();
  const activeId = useId();
  const businessLineId = useId();
  const modalityId = useId();
  const durationId = useId();
  const benefitTypeId = useId();
  const enrollmentTypeId = useId();
  const firstPaymentId = useId();
  const baseEnrollmentTypeId = useId();
  const baseBusinessLineId = useId();
  const baseModalityId = useId();
  const baseCampusId = useId();
  const baseTierId = useId();
  const basePlanId = useId();
  const basePercentId = useId();
  const baseAverageRangeId = useId();
  const [open, setOpen] = useState(false);
  const [activePanel, setActivePanel] = useState<BenefitsPanel>("benefits");
  const [editing, setEditing] = useState<Benefit | null>(null);

  const percentOptions = useMemo(
    () =>
      Array.from({ length: 20 }, (_, index) => (index + 1) * 5).map((value) => ({
        value: String(value),
        label: `${value}%`,
      })),
    [],
  );

  const campusSelectOptions = useMemo(
    () => [{ value: "__ALL__", label: "Todos" }, ...campusOptions.map((campus) => ({
      value: campus.value,
      label: campus.tier ? `${campus.label} · ${campus.tier}` : campus.label,
    }))],
    [campusOptions],
  );
  const baseTierOptions = useMemo(() => {
    const tiers = new Set<string>();
    for (const row of baseScholarships) {
      const tier = String(row.campusTier ?? "").trim().toUpperCase();
      if (tier && tier !== "ANY" && tier !== "GENERAL") {
        tiers.add(tier);
      }
    }
    for (const campus of campusOptions) {
      const tier = String(campus.tier ?? "").trim().toUpperCase();
      if (tier && tier !== "ANY" && tier !== "GENERAL") {
        tiers.add(tier);
      }
    }

    return [
      { value: "ANY", label: "General" },
      ...Array.from(tiers)
        .sort((left, right) => left.localeCompare(right, "es-MX", { numeric: true }))
        .map((tier) => ({ value: tier, label: tier })),
    ];
  }, [baseScholarships, campusOptions]);

  const [campusIds, setCampusIds] = useState<string[]>([]);
  const [extraPercent, setExtraPercent] = useState<string>("");
  const [firstPaymentAmount, setFirstPaymentAmount] = useState<string>("");
  const [isActive, setIsActive] = useState<string>("true");
  const [notes, setNotes] = useState<string>("");
  const [benefitType, setBenefitType] = useState<string>("percentage");
  const [enrollmentType, setEnrollmentType] = useState<string>("");
  const [businessLine, setBusinessLine] = useState<string>("");
  const [modality, setModality] = useState<string>("");
  const [duration, setDuration] = useState<string>("");
  const [importLoading, setImportLoading] = useState(false);
  const [applyImportLoading, setApplyImportLoading] = useState(false);
  const [rollbackImportLoading, setRollbackImportLoading] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSummary, setImportSummary] = useState<BenefitImportSummary | null>(null);
  const [importPreviewRows, setImportPreviewRows] = useState<BenefitImportPreviewRow[]>([]);
  const [importSessionId, setImportSessionId] = useState<string | null>(null);
  const [importApplied, setImportApplied] = useState(false);
  const [importRolledBack, setImportRolledBack] = useState(false);
  const [baseImportLoading, setBaseImportLoading] = useState(false);
  const [baseApplyImportLoading, setBaseApplyImportLoading] = useState(false);
  const [baseRollbackImportLoading, setBaseRollbackImportLoading] = useState(false);
  const [baseImportError, setBaseImportError] = useState<string | null>(null);
  const [baseImportErrorDetails, setBaseImportErrorDetails] = useState<string[]>([]);
  const [baseImportSummary, setBaseImportSummary] =
    useState<BaseScholarshipImportSummary | null>(null);
  const [baseImportPreviewRows, setBaseImportPreviewRows] = useState<
    BaseScholarshipImportPreviewRow[]
  >([]);
  const [baseImportSessionId, setBaseImportSessionId] = useState<string | null>(null);
  const [baseImportApplied, setBaseImportApplied] = useState(false);
  const [baseImportRolledBack, setBaseImportRolledBack] = useState(false);
  const [baseEnrollmentType, setBaseEnrollmentType] = useState("nuevo_ingreso");
  const [baseBusinessLine, setBaseBusinessLine] = useState("licenciatura");
  const [baseModality, setBaseModality] = useState("presencial");
  const [baseCampus, setBaseCampus] = useState("__ALL__");
  const [basePlan, setBasePlan] = useState("");
  const [basePercent, setBasePercent] = useState("");
  const [baseMinAverage, setBaseMinAverage] = useState("");
  const [baseMaxAverage, setBaseMaxAverage] = useState("");
  const [editingBaseScholarshipId, setEditingBaseScholarshipId] = useState("");
  const [editingBaseCampusTier, setEditingBaseCampusTier] = useState("ANY");
  const sortedBenefits = useMemo(
    () =>
      [...benefits].sort((left, right) => {
        const businessLine = compareBusinessLine(left.businessLine, right.businessLine);
        if (businessLine !== 0) return businessLine;
        return compareAdminPricingScope(benefitScope(left), benefitScope(right));
      }),
    [benefits],
  );
  const sortedBaseScholarships = useMemo(
    () =>
      [...baseScholarships].sort((left, right) => {
        const businessLine = compareBusinessLine(left.businessLine, right.businessLine);
        if (businessLine !== 0) return businessLine;
        const scope = compareAdminPricingScope(
          { region: "General", plantel: "Todos", tier: left.campusTier, modality: left.modality },
          { region: "General", plantel: "Todos", tier: right.campusTier, modality: right.modality },
        );
        if (scope !== 0) return scope;
        return (
          [
            left.modality.localeCompare(right.modality),
            left.plan - right.plan,
          ].find((result) => result !== 0) ?? 0
        );
      }),
    [baseScholarships],
  );

  const { handleSubmit, saveState, saving, clearSaveState } = useAdminActionForm(
    upsertBenefitAction,
    "No fue posible guardar el beneficio.",
  );
  const {
    handleSubmit: handleBaseScholarshipSubmit,
    saveState: baseScholarshipSaveState,
    saving: baseScholarshipSaving,
  } = useAdminActionForm(
    upsertBaseScholarshipAction,
    "No fue posible guardar la beca por promedio.",
  );

  useEffect(() => {
    if (!saveState?.ok) return;
    const timer = window.setTimeout(() => {
      setOpen(false);
      setEditing(null);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [saveState?.ok]);

  useEffect(() => {
    if (!baseScholarshipSaveState?.ok) return;
    setEditingBaseScholarshipId("");
  }, [baseScholarshipSaveState?.ok]);

  function handleBenefitTypeChange(value: string) {
    setBenefitType(value);
    if (value === "first_payment") {
      setDuration("pago_inicial");
      setExtraPercent("");
    } else {
      setFirstPaymentAmount("");
    }
  }

  function startCreate() {
    clearSaveState();
    setEditing(null);
    setCampusIds([]);
    setExtraPercent("");
    setFirstPaymentAmount("");
    setIsActive("true");
    setNotes("");
    setBenefitType("percentage");
    setEnrollmentType("");
    setBusinessLine("");
    setModality("");
    setDuration("");
    setOpen(true);
  }

  function startEdit(benefit: Benefit) {
    clearSaveState();
    setEditing(benefit);
    setCampusIds(benefit.appliesToAll ? ["__ALL__"] : benefit.campusIds ?? []);
    setExtraPercent(
      benefit.benefitType === "percentage" ? String(benefit.extraPercent ?? "") : "",
    );
    setFirstPaymentAmount(
      benefit.benefitType === "first_payment"
        ? String(benefit.firstPaymentAmount ?? "")
        : "",
    );
    setIsActive(benefit.isActive ? "true" : "false");
    setNotes(benefit.notes ?? "");
    setBenefitType(benefit.benefitType ?? "percentage");
    setEnrollmentType(benefit.enrollmentType ?? "");
    setBusinessLine(benefit.businessLine ?? "");
    setModality(benefit.modality ?? "");
    setDuration(
      benefit.benefitType === "first_payment"
        ? benefit.duration ?? "pago_inicial"
        : benefit.duration ?? "",
    );
    setOpen(true);
  }

  const normalizedCampusIds = campusIds.includes("__ALL__")
    ? ["__ALL__"]
    : campusIds.filter((value) => value !== "__ALL__");

  function startCreateBaseScholarship() {
    setEditingBaseScholarshipId("");
    setEditingBaseCampusTier("ANY");
    setBaseCampus("__ALL__");
    setBasePlan("");
    setBasePercent("");
    setBaseMinAverage("");
    setBaseMaxAverage("");
  }

  function startEditBaseScholarship(row: BaseScholarshipRow, rule: BaseScholarshipRuleRow) {
    setEditingBaseScholarshipId(rule.id);
    setEditingBaseCampusTier(row.campusTier);
    setBaseEnrollmentType(row.enrollmentType);
    setBaseBusinessLine(row.businessLine);
    setBaseModality(row.modality);
    setBaseCampus("__ALL__");
    setBasePlan(String(row.plan));
    setBasePercent(rule.scholarshipPercent === null ? "" : String(rule.scholarshipPercent));
    setBaseMinAverage(rule.minAverage === null ? "" : String(rule.minAverage));
    setBaseMaxAverage(rule.maxAverage === null ? "" : String(rule.maxAverage));
  }

  const baseAverageRangeValue =
    findBaseScholarshipAverageRange(baseMinAverage, baseMaxAverage)?.value ?? "";

  function handleBaseAverageRangeChange(value: string) {
    const range = resolveBaseScholarshipAverageRange(value);
    setBaseMinAverage(range?.minAverage ?? "");
    setBaseMaxAverage(range?.maxAverage ?? "");
  }

  function handleBaseCampusChange(value: string) {
    setBaseCampus(value);
    if (value === "__ALL__") {
      setEditingBaseCampusTier("ANY");
      return;
    }

    const campus = campusOptions.find((option) => option.value === value);
    const tier = String(campus?.tier ?? "").trim().toUpperCase();
    setEditingBaseCampusTier(tier || "ANY");
  }

  async function validateImportCsv() {
    setImportLoading(true);
    setImportError(null);
    setImportApplied(false);
    setImportRolledBack(false);
    setImportSummary(null);
    try {
      const file = importFileRef.current?.files?.[0] ?? null;
      if (!file) {
        throw new Error("Selecciona un archivo CSV de beneficios.");
      }
      const formData = new FormData();
      formData.set("file", file);
      const response = await fetch("/api/admin/benefits/import", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as BenefitImportSummary | ApiError;
      if (!response.ok || payload.ok === false) {
        throw new Error(payload.ok === false ? payload.error : "No fue posible validar el CSV.");
      }
      setImportSummary(payload);
      setImportPreviewRows(payload.previewRows ?? []);
      setImportSessionId(payload.sessionId);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "No fue posible validar el CSV.");
    } finally {
      setImportLoading(false);
    }
  }

  async function applyImportSession() {
    if (!importSessionId) return;
    setApplyImportLoading(true);
    setImportError(null);
    try {
      const response = await fetch(`/api/admin/benefits/import/${importSessionId}/apply`, {
        method: "POST",
      });
      const payload = (await response.json()) as BenefitImportSummary | ApiError;
      if (!response.ok || payload.ok === false) {
        throw new Error(payload.ok === false ? payload.error : "No fue posible aplicar la sesión.");
      }
      setImportSummary((previous) =>
        previous
          ? { ...previous, ...payload, applied: true }
          : { ...payload, applied: true },
      );
      setImportApplied(true);
      setImportRolledBack(false);
      router.refresh();
    } catch (error) {
      setImportError(
        error instanceof Error ? error.message : "No fue posible aplicar la importación.",
      );
    } finally {
      setApplyImportLoading(false);
    }
  }

  async function rollbackImportSession() {
    if (!importSessionId) return;
    setRollbackImportLoading(true);
    setImportError(null);
    try {
      const response = await fetch(`/api/admin/benefits/import/${importSessionId}/rollback`, {
        method: "POST",
      });
      const payload = (await response.json()) as { ok: true } | ApiError;
      if (!response.ok || payload.ok === false) {
        throw new Error(payload.ok === false ? payload.error : "No fue posible revertir la sesión.");
      }
      setImportRolledBack(true);
      setImportApplied(false);
      router.refresh();
    } catch (error) {
      setImportError(
        error instanceof Error ? error.message : "No fue posible ejecutar rollback.",
      );
    } finally {
      setRollbackImportLoading(false);
    }
  }

  async function validateBaseScholarshipImportCsv() {
    setBaseImportLoading(true);
    setBaseImportError(null);
    setBaseImportErrorDetails([]);
    setBaseImportApplied(false);
    setBaseImportRolledBack(false);
    setBaseImportSummary(null);
    try {
      const file = baseScholarshipImportFileRef.current?.files?.[0] ?? null;
      if (!file) {
        throw new Error("Selecciona un archivo CSV de % de beca por promedio.");
      }
      const formData = new FormData();
      formData.set("file", file);
      const response = await fetch("/api/admin/benefits/base-scholarships/import", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as BaseScholarshipImportSummary | ApiError;
      if (!response.ok || payload.ok === false) {
        if (payload.ok === false) setBaseImportErrorDetails(apiErrorDetails(payload));
        throw new Error(payload.ok === false ? payload.error : "No fue posible validar el CSV.");
      }
      setBaseImportSummary(payload);
      setBaseImportPreviewRows(payload.previewRows ?? []);
      setBaseImportSessionId(payload.sessionId);
    } catch (error) {
      setBaseImportError(error instanceof Error ? error.message : "No fue posible validar el CSV.");
    } finally {
      setBaseImportLoading(false);
    }
  }

  async function applyBaseScholarshipImportSession() {
    if (!baseImportSessionId) return;
    setBaseApplyImportLoading(true);
    setBaseImportError(null);
    setBaseImportErrorDetails([]);
    try {
      const response = await fetch(
        `/api/admin/benefits/base-scholarships/import/${baseImportSessionId}/apply`,
        { method: "POST" },
      );
      const payload = (await response.json()) as BaseScholarshipImportSummary | ApiError;
      if (!response.ok || payload.ok === false) {
        if (payload.ok === false) setBaseImportErrorDetails(apiErrorDetails(payload));
        throw new Error(payload.ok === false ? payload.error : "No fue posible aplicar la sesión.");
      }
      setBaseImportSummary((previous) =>
        previous ? { ...previous, ...payload, applied: true } : { ...payload, applied: true },
      );
      setBaseImportApplied(true);
      setBaseImportRolledBack(false);
      router.refresh();
    } catch (error) {
      setBaseImportError(
        error instanceof Error ? error.message : "No fue posible aplicar la importación.",
      );
    } finally {
      setBaseApplyImportLoading(false);
    }
  }

  async function rollbackBaseScholarshipImportSession() {
    if (!baseImportSessionId) return;
    setBaseRollbackImportLoading(true);
    setBaseImportError(null);
    setBaseImportErrorDetails([]);
    try {
      const response = await fetch(
        `/api/admin/benefits/base-scholarships/import/${baseImportSessionId}/rollback`,
        { method: "POST" },
      );
      const payload = (await response.json()) as { ok: true } | ApiError;
      if (!response.ok || payload.ok === false) {
        throw new Error(payload.ok === false ? payload.error : "No fue posible revertir la sesión.");
      }
      setBaseImportRolledBack(true);
      setBaseImportApplied(false);
      router.refresh();
    } catch (error) {
      setBaseImportError(
        error instanceof Error ? error.message : "No fue posible ejecutar rollback.",
      );
    } finally {
      setBaseRollbackImportLoading(false);
    }
  }

  return (
    <section className="ui-card ui-card-pad">
      <div className="ui-toolbar">
        <div>
          <h1 className="mt-1 text-lg font-semibold">Beneficios adicionales</h1>
          <p className="mt-1 text-sm text-slate-300">
            Configura descuentos porcentuales y el beneficio especial de Primer pago por
            plantel, tipo de ingreso y alcance académico.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setActivePanel("benefits");
            startCreate();
          }}
          className="ui-button-primary px-4 py-2 text-sm"
        >
          Nuevo
        </button>
      </div>

      <div className="mt-5">
        <AdminSegmentedTabs
          ariaLabel="Vistas de beneficios"
          activeId={activePanel}
          onChange={(panel) => setActivePanel(panel as BenefitsPanel)}
          tone="light"
          items={[
          { id: "benefits", label: `Listado (${sortedBenefits.length})` },
          { id: "base", label: `% por promedio (${baseScholarships.length})` },
          { id: "imports", label: "Importaciones" },
          ]}
        />
      </div>

      {activePanel === "imports" ? (
      <section className="mt-5 grid min-w-0 gap-3 overflow-hidden rounded-2xl border border-[color:var(--ui-border)] bg-[color:var(--ui-surface-secondary)] p-4">
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-[0.24em] text-[color:var(--ui-text-secondary)]">
              Importar beneficios adicionales
            </div>
            <p className="mt-1 text-sm text-[color:var(--ui-text-secondary)]">
              Para porcentajes adicionales o primer pago. No modifica el % de beca por promedio.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={validateImportCsv}
              disabled={importLoading || applyImportLoading || rollbackImportLoading}
              className="ui-button-secondary min-h-[34px] px-3 text-xs disabled:opacity-60"
            >
              {importLoading ? "Analizando..." : "Validar CSV"}
            </button>
            <button
              type="button"
              onClick={applyImportSession}
              disabled={Boolean(
                !importSessionId || applyImportLoading || importSummary?.errors?.length,
              )}
              className="ui-button-primary min-h-[34px] px-3 text-xs disabled:opacity-60"
            >
              {applyImportLoading ? "Aplicando..." : "Aplicar"}
            </button>
            <button
              type="button"
              onClick={rollbackImportSession}
              disabled={!importSessionId || !importApplied || rollbackImportLoading}
              className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900 transition hover:bg-amber-100 disabled:opacity-60"
            >
              {rollbackImportLoading ? "Revirtiendo..." : "Rollback"}
            </button>
          </div>
        </div>
        <input
          ref={importFileRef}
          type="file"
          accept=".csv,text/csv"
          className="ui-control min-w-0 max-w-full text-sm"
        />
        <div className="grid gap-2 rounded-xl border border-[color:var(--ui-border)] bg-white px-3 py-2 text-xs text-[color:var(--ui-text-secondary)] md:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
          <div>
            <div className="font-semibold text-[color:var(--ui-text-primary)]">
              Orden canónico
            </div>
            <div className="mt-1 font-mono text-[11px]">
              Línea de Negocio | Region | Plantel | Tier | Beneficio adicional
            </div>
          </div>
          <div className="font-mono text-[11px] leading-5">
            linea,region,plantel,tier,benefit_type,extra_percent,enrollment_type,modality
          </div>
        </div>
        {importError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
            {importError}
          </div>
        ) : null}
        {importSummary ? (
          <div className="grid min-w-0 gap-3">
            <div className="grid min-w-0 gap-2 sm:grid-cols-2 2xl:grid-cols-5">
              <div className="rounded-xl border border-[color:var(--ui-border)] bg-white p-2 text-xs text-[color:var(--ui-text-secondary)]">
                Procesadas: <strong className="text-[color:var(--ui-text-primary)]">{importSummary.processed}</strong>
              </div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-900">
                Crear: <strong>{importSummary.created}</strong>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
                Actualizar: <strong>{importSummary.updated}</strong>
              </div>
              <div className="rounded-xl border border-[color:var(--ui-border)] bg-white p-2 text-xs text-[color:var(--ui-text-secondary)]">
                Sin cambios: <strong className="text-[color:var(--ui-text-primary)]">{importSummary.unchanged}</strong>
              </div>
              <div className="rounded-xl border border-red-200 bg-red-50 p-2 text-xs text-red-900">
                Errores: <strong>{importSummary.errors.length}</strong>
              </div>
            </div>
            {importSummary.warnings.length ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
                {importSummary.warnings[0]}
              </div>
            ) : null}
            {importSummary.errors.length ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-800">
                {importSummary.errors[0]}
              </div>
            ) : null}
            {importRolledBack ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
                Rollback ejecutado para la sesión actual.
              </div>
            ) : null}
            {importPreviewRows.length ? (
              <div className="ui-table-wrap ui-table-wrap--scroll-y ui-scrollbar max-h-[360px]">
                <table className="ui-table ui-table--compact min-w-[900px]">
                  <thead>
                    <tr>
                      <th className="ui-cell-nowrap text-left">Fila</th>
                      <th className="ui-cell-nowrap text-left">Acción</th>
                      <th className="ui-cell-nowrap text-left">Línea de negocio</th>
                      <th className="ui-cell-nowrap text-left">Region</th>
                      <th className="ui-cell-nowrap text-left">Plantel</th>
                      <th className="ui-cell-nowrap text-left">Tier</th>
                      <th className="ui-cell-nowrap text-left">Beneficio</th>
                      <th className="ui-cell-nowrap text-left">Tipo</th>
                      <th className="ui-cell-nowrap text-left">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importPreviewRows.slice(0, 30).map((row) => (
                      <tr key={`${row.rowNumber}-${row.action}`}>
                        <td className="ui-cell-nowrap text-slate-200">{row.rowNumber}</td>
                        <td className="ui-cell-nowrap text-slate-200">{row.action}</td>
                        <td className="ui-cell-nowrap text-slate-200">
                          {resolveLabel(row.businessLine, BUSINESS_LINE_OPTIONS, "Todas")}
                        </td>
                        <td className="ui-cell-nowrap text-slate-200">
                          {normalizeAdminPricingRegion(row.region)}
                        </td>
                        <td className="text-slate-200">
                          {benefitPreviewPlantelLabel(row)}
                        </td>
                        <td className="ui-cell-nowrap text-slate-200">
                          {formatAdminPricingTier({
                            tier: row.tier,
                            plantel: benefitPreviewPlantelLabel(row),
                            modality: row.modality,
                          })}
                        </td>
                        <td className="ui-cell-nowrap text-slate-100">
                          {row.benefitType === "percentage"
                            ? `${row.extraPercent}%`
                            : row.firstPaymentAmount.toLocaleString("es-MX", {
                                style: "currency",
                                currency: "MXN",
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                        </td>
                        <td className="ui-cell-nowrap text-slate-200">{row.benefitType}</td>
                        <td className="ui-cell-nowrap text-slate-200">
                          {row.isActive ? "Activo" : "Desactivado"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>
      ) : null}

      {activePanel === "base" ? (
      <section className="mt-6 grid gap-4 rounded-2xl border border-[color:var(--ui-border)] bg-[color:var(--ui-surface-secondary)] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.24em] text-slate-400">
              % de beca por promedio
            </div>
            <h2 className="mt-1 text-lg font-semibold text-slate-100">
              Reglas canónicas aplicadas
            </h2>
          </div>
          <span className="ui-pill">{baseScholarships.length} grupos</span>
        </div>

        <div className="grid min-w-0 gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs uppercase tracking-[0.24em] text-slate-400">
                Importar % de beca por promedio
              </div>
              <p className="mt-1 text-sm text-slate-300">
                Para reglas base por promedio. No crea beneficios adicionales ni primer pago.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  downloadCsvTemplate(
                    "plantilla-beca-por-promedio.csv",
                    BASE_SCHOLARSHIP_TEMPLATE_CSV,
                  )
                }
                className="ui-button-secondary min-h-[34px] px-3 text-xs"
              >
                Descargar plantilla CSV
              </button>
              <button
                type="button"
                onClick={validateBaseScholarshipImportCsv}
                disabled={baseImportLoading || baseApplyImportLoading || baseRollbackImportLoading}
                className="ui-button-secondary min-h-[34px] px-3 text-xs disabled:opacity-60"
              >
                {baseImportLoading ? "Analizando..." : "Validar CSV"}
              </button>
              <button
                type="button"
                onClick={applyBaseScholarshipImportSession}
                disabled={Boolean(
                  !baseImportSessionId ||
                    baseApplyImportLoading ||
                    baseImportSummary?.errors?.length,
                )}
                className="ui-button-primary min-h-[34px] px-3 text-xs disabled:opacity-60"
              >
                {baseApplyImportLoading ? "Aplicando..." : "Aplicar"}
              </button>
              <button
                type="button"
                onClick={rollbackBaseScholarshipImportSession}
                disabled={!baseImportSessionId || !baseImportApplied || baseRollbackImportLoading}
                className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900 transition hover:bg-amber-100 disabled:opacity-60"
              >
                {baseRollbackImportLoading ? "Revirtiendo..." : "Rollback"}
              </button>
            </div>
          </div>
          <input
            ref={baseScholarshipImportFileRef}
            type="file"
            accept=".csv,text/csv"
            className="ui-control min-w-0 max-w-full text-sm"
          />
          <div className="grid gap-2 rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2 text-xs text-slate-300 md:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
            <div>
              <div className="font-semibold text-slate-100">Orden canónico</div>
              <div className="mt-1 font-mono text-[11px]">
                Línea de Negocio | Region | Plantel | Tier | % de beca por promedio
              </div>
            </div>
            <div className="font-mono text-[11px] leading-5">
              linea,region,plantel,tier,porcentaje,ingreso,modalidad,plan,promedio
            </div>
          </div>
          <div className="grid gap-1 rounded-xl border border-white/10 bg-slate-950/30 px-3 py-2 text-xs leading-5 text-slate-300">
            <div>
              <span className="font-semibold text-slate-100">ingreso:</span>{" "}
              nuevo_ingreso / regreso / reingreso, o etiquetas visibles como Nuevo ingreso,
              Regreso, Reingreso y NI.
            </div>
            <div>
              <span className="font-semibold text-slate-100">linea:</span>{" "}
              licenciatura / prepa / posgrado / salud, o etiquetas visibles como
              Licenciatura, Bachillerato, Posgrado y Salud.
            </div>
            <div>
              <span className="font-semibold text-slate-100">modalidad:</span>{" "}
              presencial / mixta / online, o etiquetas visibles como Escolarizada,
              Ejecutiva y Online.
            </div>
          </div>
          {baseImportError ? (
            <div className="grid gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
              <div>{baseImportError}</div>
              {baseImportErrorDetails.length ? (
                <ul className="grid gap-1 text-xs font-normal">
                  {baseImportErrorDetails.map((error) => (
                    <li key={error}>{error}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
          {baseImportSummary ? (
            <div className="grid min-w-0 gap-3">
              <div className="grid min-w-0 gap-2 sm:grid-cols-2 2xl:grid-cols-5">
                <div className="rounded-xl border border-white/10 bg-white/5 p-2 text-xs text-slate-300">
                  Procesadas: <strong className="text-slate-100">{baseImportSummary.processed}</strong>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-900">
                  Crear: <strong>{baseImportSummary.created}</strong>
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
                  Actualizar: <strong>{baseImportSummary.updated}</strong>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-2 text-xs text-slate-300">
                  Sin cambios: <strong className="text-slate-100">{baseImportSummary.unchanged}</strong>
                </div>
                <div className="rounded-xl border border-red-200 bg-red-50 p-2 text-xs text-red-900">
                  Errores: <strong>{baseImportSummary.errors.length}</strong>
                </div>
              </div>
              {baseImportSummary.warnings.length ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
                  {baseImportSummary.warnings[0]}
                </div>
              ) : null}
              {baseImportSummary.errors.length ? (
                <div className="grid gap-1 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-800">
                  {baseImportSummary.errors.map((error) => (
                    <div key={error}>{error}</div>
                  ))}
                </div>
              ) : null}
              {baseImportRolledBack ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
                  Rollback ejecutado para la sesión actual.
                </div>
              ) : null}
              {baseImportPreviewRows.length ? (
                <div className="ui-table-wrap ui-table-wrap--scroll-y ui-scrollbar max-h-[320px]">
                  <table className="ui-table ui-table--compact min-w-[980px]">
                    <thead>
                      <tr>
                        <th className="ui-cell-nowrap text-left">Fila</th>
                        <th className="ui-cell-nowrap text-left">Acción</th>
                        <th className="ui-cell-nowrap text-left">Línea de negocio</th>
                        <th className="ui-cell-nowrap text-left">Region</th>
                        <th className="ui-cell-nowrap text-left">Plantel</th>
                        <th className="ui-cell-nowrap text-left">Tier</th>
                        <th className="ui-cell-nowrap text-right">% Beca</th>
                        <th className="ui-cell-nowrap text-left">Ingreso</th>
                        <th className="ui-cell-nowrap text-left">Detalle</th>
                        <th className="ui-cell-nowrap text-left">Promedio</th>
                      </tr>
                    </thead>
                    <tbody>
                      {baseImportPreviewRows.slice(0, 30).map((row) => (
                        <tr key={`${row.rowNumber}-${row.action}`}>
                          <td className="ui-cell-nowrap text-slate-200">{row.rowNumber}</td>
                          <td className="ui-cell-nowrap text-slate-200">{row.action}</td>
                          <td className="ui-cell-nowrap text-slate-200">
                            {resolveLabel(row.businessLine, BUSINESS_LINE_OPTIONS, row.businessLine)}
                          </td>
                          <td className="ui-cell-nowrap text-slate-200">
                            {normalizeAdminPricingRegion(row.region)}
                          </td>
                          <td className="ui-cell-nowrap text-slate-200">
                            {row.plantel || "Todos"}
                          </td>
                          <td className="ui-cell-nowrap text-slate-200">
                            {formatAdminPricingTier({
                              tier: row.tier,
                              plantel: row.plantel,
                              modality: row.modality,
                            })}
                          </td>
                          <td className="ui-cell-nowrap text-right font-mono text-slate-100">
                            {row.scholarshipPercent}%
                          </td>
                          <td className="ui-cell-nowrap text-slate-200">
                            {resolveLabel(row.enrollmentType, ENROLLMENT_TYPE_OPTIONS, row.enrollmentType)}
                          </td>
                          <td className="ui-cell-nowrap text-slate-200">
                            {row.modality} · plan {row.plan}
                          </td>
                          <td className="ui-cell-nowrap font-mono text-slate-100">
                            {row.minAverage} - {row.maxAverage}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(360px,0.85fr)_minmax(520px,1.15fr)]">
        <form onSubmit={handleBaseScholarshipSubmit} className="grid content-start gap-4 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-slate-100">
              {editingBaseScholarshipId ? "Editar regla" : "Nueva regla"}
            </div>
            {editingBaseScholarshipId ? (
              <button
                type="button"
                onClick={startCreateBaseScholarship}
                className="ui-button-secondary min-h-[30px] px-3 text-xs"
              >
                Cancelar
              </button>
            ) : null}
          </div>
          <input type="hidden" name="id" value={editingBaseScholarshipId} />
          <input type="hidden" name="campusTier" value={editingBaseCampusTier} />
          <input type="hidden" name="enrollmentType" value={baseEnrollmentType} />
          <input type="hidden" name="businessLine" value={baseBusinessLine} />
          <input type="hidden" name="modality" value={baseModality} />
          <input type="hidden" name="campusId" value={baseCampus} />
          <input type="hidden" name="plan" value={basePlan} />
          <input type="hidden" name="scholarshipPercent" value={basePercent} />
          <input type="hidden" name="minAverage" value={baseMinAverage} />
          <input type="hidden" name="maxAverage" value={baseMaxAverage} />

          {baseScholarshipSaveState?.ok === false && baseScholarshipSaveState.error ? (
            <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {baseScholarshipSaveState.error}
            </div>
          ) : null}
          {baseScholarshipSaveState?.ok ? (
            <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
              Beca por promedio guardada.
            </div>
          ) : null}

          <div className="ui-form-grid ui-form-grid--two">
            <div className="grid gap-2 text-sm">
              <span id={baseBusinessLineId}>Línea de negocio</span>
              <SmartSelect
                labelId={baseBusinessLineId}
                placeholder="Selecciona línea"
                value={baseBusinessLine}
                onChange={setBaseBusinessLine}
                options={BUSINESS_LINE_OPTIONS.filter((option) => option.value !== "__ALL__")}
              />
            </div>

            <div className="grid gap-2 text-sm">
              <span id={baseCampusId}>Plantel</span>
              <SmartSelect
                labelId={baseCampusId}
                placeholder="Todos"
                value={baseCampus}
                onChange={handleBaseCampusChange}
                options={campusSelectOptions}
              />
            </div>

            <div className="grid gap-2 text-sm">
              <span id={baseTierId}>Tier</span>
              <SmartSelect
                labelId={baseTierId}
                placeholder="Selecciona tier"
                value={editingBaseCampusTier}
                onChange={setEditingBaseCampusTier}
                options={baseTierOptions}
              />
            </div>
          </div>

          <div className="ui-form-grid ui-form-grid--two">
            <div className="grid gap-2 text-sm">
              <span id={baseEnrollmentTypeId}>Tipo de inscripción</span>
              <SmartSelect
                labelId={baseEnrollmentTypeId}
                placeholder="Selecciona tipo"
                value={baseEnrollmentType}
                onChange={setBaseEnrollmentType}
                options={ENROLLMENT_TYPE_OPTIONS.filter((option) => option.value !== "__ALL__")}
              />
            </div>

            <div className="grid gap-2 text-sm">
              <span id={baseModalityId}>Modalidad</span>
              <SmartSelect
                labelId={baseModalityId}
                placeholder="Selecciona modalidad"
                value={baseModality}
                onChange={setBaseModality}
                options={MODALITY_OPTIONS.filter((option) => option.value !== "__ALL__")}
              />
            </div>
          </div>

          <div className="ui-form-grid ui-form-grid--two ui-form-grid--four">
            <label className="grid gap-2 text-sm">
              <span id={basePlanId}>Plan</span>
              <input
                aria-labelledby={basePlanId}
                value={basePlan}
                onChange={(event) => setBasePlan(event.target.value)}
                inputMode="numeric"
                className="ui-control"
                placeholder="Ej. 9"
              />
            </label>
            <label className="grid gap-2 text-sm">
              <span id={basePercentId}>% de beca</span>
              <input
                aria-labelledby={basePercentId}
                value={basePercent}
                onChange={(event) => setBasePercent(event.target.value)}
                inputMode="decimal"
                className="ui-control"
                placeholder="Ej. 25"
              />
            </label>
            <div className="grid gap-2 text-sm md:col-span-2 xl:col-span-2">
              <span id={baseAverageRangeId}>Promedio</span>
              <SmartSelect
                labelId={baseAverageRangeId}
                placeholder="Selecciona rango"
                value={baseAverageRangeValue}
                onChange={handleBaseAverageRangeChange}
                options={BASE_SCHOLARSHIP_AVERAGE_RANGES.map(({ value, label }) => ({
                  value,
                  label,
                }))}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={baseScholarshipSaving}
              className="ui-button-primary px-4 py-2 text-sm disabled:opacity-60"
            >
              {baseScholarshipSaving ? "Guardando..." : "Guardar % de beca"}
            </button>
          </div>
        </form>

        {baseScholarships.length ? (
          <div className="ui-scrollbar max-h-[520px] min-w-0 overflow-y-auto rounded-2xl border border-white/10 bg-white/5">
            <div className="sticky top-0 z-10 grid grid-cols-[1fr_0.7fr_0.9fr_0.7fr_1.2fr_auto] gap-3 border-b border-white/10 bg-slate-950/95 px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-300">
              <span>Línea de negocio</span>
              <span>Region</span>
              <span>Plantel</span>
              <span>Tier</span>
              <span>Beneficio</span>
              <span className="text-right">Reglas</span>
            </div>
            <div className="divide-y divide-white/10">
              {sortedBaseScholarships.map((row) => (
                <details key={row.id} className="group">
                  <summary className="grid cursor-pointer list-none grid-cols-[1fr_0.7fr_0.9fr_0.7fr_1.2fr_auto] gap-3 px-4 py-3 text-sm text-slate-100 transition hover:bg-white/5 [&::-webkit-details-marker]:hidden">
                    <div className="ui-cell-nowrap font-semibold">
                      {resolveLabel(row.businessLine, BUSINESS_LINE_OPTIONS, row.businessLine)}
                    </div>
                    <div className="ui-cell-nowrap text-slate-300">General</div>
                    <div className="ui-cell-nowrap text-slate-300">Todos</div>
                    <div className="ui-cell-nowrap text-slate-300">
                      {formatAdminPricingTier({
                        tier: row.campusTier,
                        modality: row.modality,
                      })}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate font-semibold">
                        {row.percentages.length
                          ? row.percentages.map((value) => `${value}%`).join(", ")
                          : "0%"}
                      </div>
                      <div className="mt-1 truncate text-xs text-slate-400">
                        {resolveLabel(row.enrollmentType, ENROLLMENT_TYPE_OPTIONS, row.enrollmentType)} ·{" "}
                        {resolveLabel(row.modality, MODALITY_OPTIONS, row.modality)} · Plan {row.plan} ·{" "}
                        {row.ranges.join(", ")}
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-2 text-right">
                      <span className="ui-pill">{row.ruleCount}</span>
                      <span className="text-slate-400 transition group-open:rotate-90">›</span>
                    </div>
                  </summary>
                  <div className="grid gap-2 px-4 pb-4">
                    {row.rules.map((rule) => (
                      <div
                        key={rule.id}
                        className="grid gap-2 rounded-xl border border-white/10 bg-slate-950/50 p-3 text-sm text-slate-200 sm:grid-cols-[1fr_auto]"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-lg bg-white/10 px-2 py-1 font-mono text-xs text-slate-100">
                            {rule.rangeLabel}
                          </span>
                          <span className="rounded-lg bg-emerald-500/15 px-2 py-1 font-mono text-xs text-emerald-100">
                            {rule.scholarshipPercent ?? 0}%
                          </span>
                        </div>
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => startEditBaseScholarship(row, rule)}
                            className="ui-button-secondary min-h-[30px] px-3 text-xs"
                          >
                            Editar
                          </button>
                          <form
                            action={deleteBaseScholarshipAction}
                            onSubmit={(event) => {
                              if (!window.confirm("¿Eliminar esta regla de beca por promedio?")) {
                                event.preventDefault();
                              }
                            }}
                          >
                            <input type="hidden" name="id" value={rule.id} />
                            <button
                              type="submit"
                              className="min-h-[30px] rounded-xl border border-red-300 bg-red-100 px-3 text-xs font-semibold text-red-950 transition hover:bg-red-200"
                            >
                              Eliminar
                            </button>
                          </form>
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
            No hay becas base canónicas cargadas. Si el cotizador falla, falta poblar
            scholarshipRule para el ciclo activo.
          </div>
        )}
        </div>
      </section>
      ) : null}

      {activePanel === "benefits" ? (
      sortedBenefits.length ? (
        <div className="ui-table-wrap ui-table-wrap--scroll-y ui-scrollbar mt-6 max-h-[620px]">
          <table className="ui-table min-w-[1240px]">
            <thead>
              <tr>
                <th className="ui-cell-nowrap text-left">Línea de negocio</th>
                <th className="ui-cell-nowrap text-left">Region</th>
                <th className="min-w-[220px] text-left">Plantel</th>
                <th className="ui-cell-nowrap text-left">Tier</th>
                <th className="ui-cell-nowrap text-left">Beneficio</th>
                <th className="ui-cell-nowrap text-left">Tipo</th>
                <th className="ui-cell-nowrap text-left">Ingreso</th>
                <th className="ui-cell-nowrap text-left">Modalidad</th>
                <th className="ui-cell-nowrap text-left">Duración</th>
                <th className="ui-cell-nowrap text-left">Estado</th>
                <th className="text-left">Notas</th>
                <th className="ui-cell-nowrap text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {sortedBenefits.map((benefit) => (
                <tr key={benefit.id}>
                  <td className="ui-cell-nowrap text-slate-100">
                    {resolveLabel(benefit.businessLine, BUSINESS_LINE_OPTIONS, "Todas")}
                  </td>
                  <td className="ui-cell-nowrap text-slate-100">
                    {normalizeAdminPricingRegion(null)}
                  </td>
                  <td className="text-slate-100">
                    <span className="block min-w-[200px]">
                      {benefitPlantelLabel(benefit)}
                    </span>
                  </td>
                  <td className="ui-cell-nowrap text-slate-100">
                    {benefitTierLabel(benefit)}
                  </td>
                  <td className="ui-cell-nowrap text-slate-100">
                    {formatBenefitValue(benefit)}
                  </td>
                  <td className="ui-cell-nowrap text-slate-100">
                    {resolveLabel(
                      benefit.benefitType,
                      BENEFIT_TYPE_OPTIONS,
                      benefit.benefitType,
                    )}
                  </td>
                  <td className="ui-cell-nowrap text-slate-100">
                    {resolveLabel(
                      benefit.enrollmentType,
                      ENROLLMENT_TYPE_OPTIONS,
                      "Cualquier ingreso",
                    )}
                  </td>
                  <td className="ui-cell-nowrap text-slate-100">
                    {resolveLabel(benefit.modality, MODALITY_OPTIONS, "Todas")}
                  </td>
                  <td className="ui-cell-nowrap text-slate-100">
                    {resolveLabel(benefit.duration, DURATION_OPTIONS, "Cualquiera")}
                  </td>
                  <td className="ui-cell-nowrap text-slate-100">
                    {benefit.isActive ? "Activo" : "Desactivado"}
                  </td>
                  <td className="text-slate-200">{benefit.notes ?? "-"}</td>
                  <td className="ui-cell-nowrap text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(benefit)}
                        className="ui-button-secondary min-h-[34px] whitespace-nowrap px-3 text-xs"
                      >
                        Editar
                      </button>
                      <form
                        action={deleteBenefitAction}
                        onSubmit={(event) => {
                          if (!window.confirm("¿Eliminar este beneficio?")) {
                            event.preventDefault();
                          }
                        }}
                      >
                        <input type="hidden" name="id" value={benefit.id} />
                        <button
                          type="submit"
                          className="whitespace-nowrap rounded-xl border border-red-300 bg-red-100 px-3 py-2 text-xs font-semibold text-red-950 transition hover:bg-red-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/30"
                        >
                          Eliminar
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border border-white/10 bg-slate-950/30 p-6">
          <div className="flex min-h-[220px] flex-col items-center justify-center gap-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-200">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="h-6 w-6"
                aria-hidden="true"
              >
                <path
                  d="M12 6v12m6-6H6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-100">
                No hay beneficios configurados.
              </div>
              <div className="mt-1 text-xs text-slate-400">
                Crea un beneficio adicional para iniciar.
              </div>
            </div>
            <button
              type="button"
              onClick={startCreate}
              className="ui-button-primary px-4 py-2 text-sm"
            >
              Nuevo
            </button>
          </div>
        </div>
      )
      ) : null}

      <AdminDialogShell
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) {
            clearSaveState();
          }
        }}
        kicker={editing ? "Editar" : "Nuevo"}
        title="Beneficio adicional"
        description="Configura alcance, tipo, valor y estado del beneficio adicional sin salir del módulo."
        size="xl"
      >
        {saveState?.ok === false && saveState.error ? (
          <div className="mb-4 rounded-2xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {saveState.error}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="grid gap-4">
          <input type="hidden" name="id" value={editing?.id ?? ""} />
          <input type="hidden" name="campusIds" value={JSON.stringify(normalizedCampusIds)} />
          <input type="hidden" name="benefitType" value={benefitType} />
          <input type="hidden" name="enrollmentType" value={enrollmentType || ""} />
          <input type="hidden" name="businessLine" value={businessLine || ""} />
          <input type="hidden" name="modality" value={modality || ""} />
          <input type="hidden" name="duration" value={duration || ""} />
          <input type="hidden" name="extraPercent" value={extraPercent} />
          <input
            type="hidden"
            name="firstPaymentAmount"
            value={firstPaymentAmount}
          />
          <input type="hidden" name="isActive" value={isActive} />

          <div className="ui-form-grid ui-form-grid--two ui-form-grid--four">
            <div className="grid gap-2 text-sm">
              <span id={businessLineId}>Línea de negocio</span>
              <SmartSelect
                labelId={businessLineId}
                placeholder="Todas"
                value={businessLine || ""}
                onChange={setBusinessLine}
                options={BUSINESS_LINE_OPTIONS}
              />
            </div>

            <SmartMultiSelect
              label="Plantel(es)"
              labelId={labelId}
              options={campusSelectOptions.map((option) => ({
                ...option,
                disabled:
                  campusIds.includes("__ALL__") && option.value !== "__ALL__" ? true : false,
              }))}
              value={campusIds}
              onChange={setCampusIds}
              placeholder="Selecciona uno o varios"
            />

            <div className="grid gap-2 text-sm">
              <span id={benefitTypeId}>Tipo de beneficio</span>
              <SmartSelect
                labelId={benefitTypeId}
                placeholder="Selecciona tipo"
                value={benefitType}
                onChange={handleBenefitTypeChange}
                options={BENEFIT_TYPE_OPTIONS}
              />
            </div>

            <div className="grid gap-2 text-sm">
              <span id={enrollmentTypeId}>Tipo de ingreso</span>
              <SmartSelect
                labelId={enrollmentTypeId}
                placeholder="Cualquier ingreso"
                value={enrollmentType || ""}
                onChange={setEnrollmentType}
                options={ENROLLMENT_TYPE_OPTIONS}
              />
            </div>

            <div className="grid gap-2 text-sm">
              <span id={modalityId}>Modalidad</span>
              <SmartSelect
                labelId={modalityId}
                placeholder="Todas"
                value={modality || ""}
                onChange={setModality}
                options={MODALITY_OPTIONS}
              />
            </div>

            <div className="grid gap-2 text-sm">
              <span id={durationId}>Duración</span>
              <SmartSelect
                labelId={durationId}
                placeholder={benefitType === "first_payment" ? "Pago inicial" : "Cualquiera"}
                value={duration || ""}
                onChange={setDuration}
                options={DURATION_OPTIONS}
                disabled={benefitType === "first_payment"}
              />
            </div>

            {benefitType === "first_payment" ? (
              <label className="grid gap-2 text-sm">
                <span id={firstPaymentId}>Monto de primer pago</span>
                <input
                  aria-labelledby={firstPaymentId}
                  value={firstPaymentAmount}
                  onChange={(event) => setFirstPaymentAmount(event.target.value)}
                  inputMode="decimal"
                  className="ui-control"
                  placeholder="Ej. 1500"
                />
              </label>
            ) : (
              <div className="grid gap-2">
                <div id={percentId} className="text-sm">
                  % adicional
                </div>
                <SmartSelect
                  labelId={percentId}
                  placeholder="Selecciona..."
                  value={extraPercent}
                  onChange={setExtraPercent}
                  options={percentOptions}
                />
              </div>
            )}

            <div className="grid gap-2 sm:col-span-2 xl:col-span-2">
              <div id={activeId} className="text-sm">
                Estado
              </div>
              <AppSelect
                labelId={activeId}
                placeholder="Selecciona..."
                value={isActive}
                onValueChange={setIsActive}
                options={[
                  { value: "true", label: "Activo" },
                  { value: "false", label: "Desactivado" },
                ]}
              />
            </div>
          </div>

          <label className="grid gap-2 text-sm">
            {benefitType === "first_payment" ? "Notas visibles del primer pago" : "Notas"}
            <textarea
              name="notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="ui-control min-h-[96px]"
              placeholder={
                benefitType === "first_payment"
                  ? "Ej. Aplica al primer pago."
                  : "Opcional"
              }
            />
          </label>

          <div className="sticky bottom-0 z-10 -mx-1 bg-[color:var(--ui-surface-primary)] px-1 pt-3">
            <button
              type="submit"
              disabled={saving}
              className="ui-button-primary w-full px-3 py-2 text-sm disabled:opacity-60"
            >
              {saving ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>
      </AdminDialogShell>
    </section>
  );
}
