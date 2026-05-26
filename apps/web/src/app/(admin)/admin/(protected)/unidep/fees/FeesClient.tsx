"use client";

import { type ChangeEvent, type FormEvent, useMemo, useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import AdminSegmentedTabs from "@/components/admin/AdminSegmentedTabs";
import {
  compareAdminPricingScope,
  formatAdminPricingPlantel,
  formatAdminPricingTier,
  normalizeAdminPricingRegion,
} from "@/lib/admin-pricing-display";
import {
  seedCampusFeesJsonAction,
  seedFeesJsonAction,
  seedMateriasImportAction,
  upsertCampusFeeAction,
  upsertFeeAction,
  upsertMateriaAction,
  type MateriaRow,
} from "./actions";

type FeeSection = "EXAMENES" | "TRAMITES" | "DIVERSOS";

type Fee = {
  id: string;
  code: string;
  concept: string;
  costMxn: number;
  section: FeeSection;
  isActive: boolean;
};

type CampusFee = {
  id: string;
  campusId: string;
  academicFeeId: string;
  isActive: boolean;
  overrideCostMxn: number | null;
};

type Campus = {
  id: string;
  name: string;
  code: string;
  metaKey: string;
  kind: "campus" | "online";
  tier: string | null;
};

type Tab = "fees" | "availability" | "materias" | "seed";
type SeedMode = "fees" | "campus" | "materias";
type SeedFormat = "json" | "csv";
type FeedbackState = { tone: "success" | "error"; message: string } | null;

type SeedResult = {
  created?: number;
  updated?: number;
  activated?: number;
  deactivated?: number;
  errors?: string[];
};

type SeedPreview = {
  ok: boolean;
  rows: number;
  errors: string[];
  sample: string[][];
};

type SeedActionResult = SeedResult & {
  ok: boolean;
  error?: string;
};

type FeeDraft = {
  mode: "create" | "edit";
  id: string;
  code: string;
  concept: string;
  section: FeeSection;
  costMxn: string;
  isActive: boolean;
};

type CampusDraft = {
  academicFeeId: string;
  concept: string;
  section: FeeSection;
  baseCostMxn: number;
  overrideCostMxn: string;
  isActive: boolean;
};

type MateriaDraft = {
  mode: "create" | "edit";
  plantel: string;
  modalidad: string;
  materias_count: string;
  costo: string;
  origPlantel: string;
  origModalidad: string;
  origMaterias: string;
};

const SECTION_LABELS: Record<FeeSection, string> = {
  EXAMENES: "Exámenes",
  TRAMITES: "Trámites",
  DIVERSOS: "Diversos",
};

const TAB_ORDER: Tab[] = ["fees", "availability", "materias", "seed"];

const TAB_LABELS: Record<Tab, string> = {
  fees: "Trámites / Cuotas",
  availability: "Disponibilidad por plantel",
  materias: "Precio por materia",
  seed: "Seed desde JSON / CSV",
};

const SEED_MODE_LABELS: Record<SeedMode, string> = {
  fees: "Trámites / Cuotas",
  campus: "Disponibilidad por plantel",
  materias: "Precio por materia",
};

const MODALITY_OPTIONS = ["presencial", "mixta", "online"] as const;

function formatMoney(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "N/A";
  }
  return `$${Number(value).toLocaleString("es-MX")}`;
}

function getSeedGuide(mode: SeedMode, format: SeedFormat) {
  if (mode === "fees" && format === "json") {
    return {
      title: "Importa o pega costos académicos para Trámites / Cuotas.",
      detail:
        "Acepta un array o un objeto con la llave cuotas_tramites_y_diversos. Cada fila debe incluir code, concept, section y cost_mxn.",
      sample:
        '{ "cuotas_tramites_y_diversos": [\n  { "code": "EX001", "concept": "Examen ordinario", "section": "EXÁMENES", "cost_mxn": 150 },\n  { "code": "TR001", "concept": "Titulación", "section": "TRÁMITES", "cost_mxn": 2500 }\n] }',
      placeholder: '{ "cuotas_tramites_y_diversos": [...] }',
    };
  }

  if (mode === "fees" && format === "csv") {
    return {
      title: "Importa un CSV para crear o actualizar Trámites / Cuotas.",
      detail:
        "Acepta columnas en cualquier orden si el archivo trae encabezados equivalentes a código, concepto, sección y costo. Puedes usar coma, punto y coma, tabulador o barra vertical como separador.",
      sample:
        "concepto,costo,sección,código\nExamen ordinario,150,EXÁMENES,EX001\nTitulación,2500,TRÁMITES,TR001",
      placeholder: "concepto,costo,sección,código",
    };
  }

  if (mode === "campus" && format === "json") {
    return {
      title: "Importa o pega activaciones por plantel en JSON.",
      detail:
        "Acepta un array con code, campus_code o campus_codes, e is_active. Este formato sirve para cambios puntuales por código.",
      sample:
        '[\n  { "code": "EX001", "campus_code": "AGS", "is_active": true },\n  { "code": "TR001", "campus_codes": ["AGS", "TIJ"], "is_active": true },\n  { "code": "EX002", "campus_code": "CDMX", "is_active": false }\n]',
      placeholder: '[{ "code": "...", "campus_code": "...", "is_active": true }]',
    };
  }

  if (mode === "campus" && format === "csv") {
    return {
      title: "Importa la disponibilidad de un plantel desde CSV.",
      detail:
        "Primero elige el plantel. El CSV debe venir como: Concepto | Sección | Costo base. Las filas cargadas quedarán activas para ese plantel y las demás se desactivarán.",
      sample:
        "Concepto|Sección|Costo base\nExamen ordinario|EXÁMENES|150\nTitulación|TRÁMITES|2500",
      placeholder: "Concepto|Sección|Costo base",
    };
  }

  if (mode === "materias" && format === "json") {
    return {
      title: "Importa o pega precios por materia en JSON.",
      detail:
        "Acepta un array o un objeto con la llave precios_por_materia. Cada fila debe incluir plantel, modalidad, materias_count y costo.",
      sample:
        '{ "precios_por_materia": [\n  { "plantel": "ags", "modalidad": "presencial", "materias_count": 4, "costo": 2400 },\n  { "plantel": "online", "modalidad": "online", "materias_count": 6, "costo": 3200 }\n] }',
      placeholder: '{ "precios_por_materia": [...] }',
    };
  }

  return {
    title: "Importa un CSV para crear o actualizar Precio por materia.",
    detail:
      "El orden esperado es: Region | Plantel | Tier | Modalidad | # Materias | Costo MXN. Region y Tier son opcionales; Online se trata como excepcion de tier.",
    sample:
      "Region|Plantel|Tier|Modalidad|# Materias|Costo MXN\nGeneral|AGS|T1|presencial|4|2400\nGeneral|ONLINE|Online|online|6|3200",
    placeholder: "Region|Plantel|Tier|Modalidad|# Materias|Costo MXN",
  };
}

function buildFeeDraft(fee?: Fee): FeeDraft {
  if (!fee) {
    return {
      mode: "create",
      id: "",
      code: "",
      concept: "",
      section: "TRAMITES",
      costMxn: "",
      isActive: true,
    };
  }

  return {
    mode: "edit",
    id: fee.id,
    code: fee.code,
    concept: fee.concept,
    section: fee.section,
    costMxn: String(fee.costMxn),
    isActive: fee.isActive,
  };
}

function buildMateriaDraft(row?: MateriaRow): MateriaDraft {
  if (!row) {
    return {
      mode: "create",
      plantel: "",
      modalidad: "presencial",
      materias_count: "",
      costo: "",
      origPlantel: "",
      origModalidad: "",
      origMaterias: "",
    };
  }

  return {
    mode: "edit",
    plantel: row.plantel,
    modalidad: row.modalidad,
    materias_count: String(row.materias_count),
    costo: String(row.costo),
    origPlantel: row.plantel,
    origModalidad: row.modalidad,
    origMaterias: String(row.materias_count),
  };
}

function FeedbackBanner({ feedback }: { feedback: FeedbackState }) {
  if (!feedback) return null;

  return (
    <div
      className={`rounded-2xl px-4 py-3 text-sm ${
        feedback.tone === "success"
          ? "border border-blue-900/40 bg-blue-950/20 text-emerald-200"
          : "border border-red-500/30 bg-red-500/10 text-red-200"
      }`}
    >
      {feedback.message}
    </div>
  );
}

function normalizePreviewHeader(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function parsePreviewCsv(payload: string) {
  const lines = payload
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return [] as string[][];
  const delimiter = [",", ";", "|"].sort(
    (left, right) => (lines[0]?.split(right).length ?? 0) - (lines[0]?.split(left).length ?? 0),
  )[0] ?? ",";
  return lines.map((line) => line.split(delimiter).map((cell) => cell.trim()));
}

function previewHasHeader(row: string[]) {
  const normalized = row.map(normalizePreviewHeader);
  return [
    "codigo",
    "concepto",
    "seccion",
    "costomxn",
    "costobase",
    "plantel",
    "modalidad",
    "materias",
    "region",
    "tier",
  ].some((header) => normalized.includes(header));
}

function buildSeedPreview(params: {
  mode: SeedMode;
  format: SeedFormat;
  payload: string;
}): SeedPreview {
  const payload = params.payload.trim();
  if (!payload) return { ok: false, rows: 0, errors: ["Carga o pega contenido primero."], sample: [] };

  if (params.format === "json") {
    try {
      const parsed = JSON.parse(payload) as unknown;
      const rows = Array.isArray(parsed)
        ? parsed
        : parsed && typeof parsed === "object"
          ? params.mode === "fees"
            ? (parsed as { cuotas_tramites_y_diversos?: unknown[] }).cuotas_tramites_y_diversos
            : params.mode === "materias"
              ? (parsed as { precios_por_materia?: unknown[] }).precios_por_materia
              : undefined
          : undefined;

      if (!Array.isArray(rows)) {
        return {
          ok: false,
          rows: 0,
          errors: ["El JSON no tiene el arreglo esperado para este tipo de importación."],
          sample: [],
        };
      }

      return {
        ok: rows.length > 0,
        rows: rows.length,
        errors: rows.length ? [] : ["El arreglo no contiene filas."],
        sample: rows.slice(0, 5).map((row) => [JSON.stringify(row)]),
      };
    } catch {
      return { ok: false, rows: 0, errors: ["JSON inválido."], sample: [] };
    }
  }

  const rows = parsePreviewCsv(payload);
  if (!rows.length) return { ok: false, rows: 0, errors: ["El CSV no contiene filas."], sample: [] };
  const firstRow = rows[0] ?? [];
  const hasHeader = previewHasHeader(firstRow);
  const dataRows = rows.slice(hasHeader ? 1 : 0).filter((row) =>
    row.some((cell) => String(cell ?? "").trim()),
  );

  return {
    ok: dataRows.length > 0,
    rows: dataRows.length,
    errors: dataRows.length ? [] : ["El CSV no contiene filas de datos."],
    sample: dataRows.slice(0, 5),
  };
}

export default function FeesClient({
  fees,
  campuses,
  campusFees,
  materias,
}: {
  fees: Fee[];
  campuses: Campus[];
  campusFees: CampusFee[];
  materias: MateriaRow[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("fees");
  const [selectedCampus, setSelectedCampus] = useState(campuses[0]?.id ?? "");
  const [feeQuery, setFeeQuery] = useState("");
  const [feeSectionFilter, setFeeSectionFilter] = useState<FeeSection | "all">("all");
  const [feeStatusFilter, setFeeStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [materiaFilter, setMateriaFilter] = useState("");
  const [seedMode, setSeedMode] = useState<SeedMode>("fees");
  const [seedFormat, setSeedFormat] = useState<SeedFormat>("json");
  const [seedPayload, setSeedPayload] = useState("");
  const [seedFileName, setSeedFileName] = useState("");
  const [seedError, setSeedError] = useState("");
  const [seedResult, setSeedResult] = useState<SeedResult | null>(null);
  const [seedPending, startSeedTransition] = useTransition();

  const [feeEditor, setFeeEditor] = useState<FeeDraft | null>(null);
  const [feeFeedback, setFeeFeedback] = useState<FeedbackState>(null);
  const [feePending, startFeeTransition] = useTransition();

  const [campusEditor, setCampusEditor] = useState<CampusDraft | null>(null);
  const [campusFeedback, setCampusFeedback] = useState<FeedbackState>(null);
  const [campusPending, startCampusTransition] = useTransition();

  const [materiaEditor, setMateriaEditor] = useState<MateriaDraft | null>(null);
  const [materiaFeedback, setMateriaFeedback] = useState<FeedbackState>(null);
  const [materiaPending, startMateriaTransition] = useTransition();

  const feeStats = {
    total: fees.length,
    active: fees.filter((fee) => fee.isActive).length,
    inactive: fees.filter((fee) => !fee.isActive).length,
    sections: new Set(fees.map((fee) => fee.section)).size,
  };
  const activeCampusFees = campusFees.filter((fee) => fee.isActive).length;
  const uniquePlanteles = [...new Set(materias.map((row) => row.plantel))].sort((a, b) =>
    a.localeCompare(b, "es-MX"),
  );
  const visibleFees = fees.filter((fee) => {
    const q = feeQuery.trim().toLowerCase();
    const matchesQuery =
      !q ||
      [fee.code, fee.concept, SECTION_LABELS[fee.section]]
        .join(" ")
        .toLowerCase()
        .includes(q);
    const matchesSection = feeSectionFilter === "all" || fee.section === feeSectionFilter;
    const matchesStatus =
      feeStatusFilter === "all" ||
      (feeStatusFilter === "active" ? fee.isActive : !fee.isActive);
    return matchesQuery && matchesSection && matchesStatus;
  });
  const visibleMaterias = materias.filter(
    (row) => !materiaFilter || row.plantel === materiaFilter,
  ).sort((left, right) =>
    compareAdminPricingScope(
      {
        region: left.region,
        plantel: left.plantel,
        tier: left.tier,
        kind: left.kind,
        modality: left.modalidad,
        value: left.materias_count,
      },
      {
        region: right.region,
        plantel: right.plantel,
        tier: right.tier,
        kind: right.kind,
        modality: right.modalidad,
        value: right.materias_count,
      },
    ),
  );
  const campusName = campuses.find((campus) => campus.id === selectedCampus)?.name ?? "";
  const selectedCampusRecord = campuses.find((campus) => campus.id === selectedCampus) ?? null;
  const seedGuide = getSeedGuide(seedMode, seedFormat);
  const seedPreview = useMemo(
    () => buildSeedPreview({ mode: seedMode, format: seedFormat, payload: seedPayload }),
    [seedFormat, seedMode, seedPayload],
  );

  const campusFeeMap = campusFees.reduce<Record<string, CampusFee>>((map, fee) => {
    if (fee.campusId === selectedCampus) {
      map[fee.academicFeeId] = fee;
    }
    return map;
  }, {});

  function resetSeedFeedback() {
    setSeedError("");
    setSeedResult(null);
  }

  function changeSeedMode(nextMode: SeedMode) {
    setSeedMode(nextMode);
    setSeedPayload("");
    setSeedFileName("");
    resetSeedFeedback();
  }

  function changeSeedFormat(nextFormat: SeedFormat) {
    setSeedFormat(nextFormat);
    resetSeedFeedback();
  }

  async function handleSeedFileSelection(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const extension = file.name.toLowerCase().split(".").pop();
      if (extension !== "json" && extension !== "csv") {
        throw new Error("Formato no soportado. Usa archivos .json o .csv.");
      }

      const text = await file.text();
      setSeedFormat(extension);
      setSeedPayload(text);
      setSeedFileName(file.name);
      resetSeedFeedback();
    } catch (error) {
      setSeedPayload("");
      setSeedFileName("");
      setSeedError(
        error instanceof Error
          ? error.message
          : "No fue posible leer el archivo seleccionado.",
      );
      setSeedResult(null);
    } finally {
      event.target.value = "";
    }
  }

  function handleSeedSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    resetSeedFeedback();

    const formData = new FormData();
    formData.set("format", seedFormat);
    formData.set("payload", seedPayload);
    if (seedMode === "campus" && seedFormat === "csv") {
      formData.set("campusId", selectedCampus);
    }

    startSeedTransition(async () => {
      const result = (
        seedMode === "fees"
          ? await seedFeesJsonAction(formData)
          : seedMode === "campus"
            ? await seedCampusFeesJsonAction(formData)
            : await seedMateriasImportAction(formData)
      ) as SeedActionResult;

      if (result.ok) {
        setSeedResult({
          created: result.created,
          updated: result.updated,
          activated: result.activated,
          deactivated: result.deactivated,
          errors: result.errors,
        });
        router.refresh();
      } else {
        setSeedError(result.error ?? "No fue posible completar la importación.");
      }
    });
  }

  function handleFeeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeeFeedback(null);

    const formData = new FormData(event.currentTarget);
    startFeeTransition(async () => {
      const result = await upsertFeeAction(formData);
      if (result.ok) {
        setFeeFeedback({
          tone: "success",
          message:
            feeEditor?.mode === "edit"
              ? "Costo actualizado correctamente."
              : "Costo agregado correctamente.",
        });
        setFeeEditor(null);
        router.refresh();
      } else {
        setFeeFeedback({
          tone: "error",
          message: result.error ?? "No fue posible guardar el costo.",
        });
      }
    });
  }

  function handleFeeToggle(fee: Fee) {
    setFeeFeedback(null);
    const formData = new FormData();
    formData.set("id", fee.id);
    formData.set("code", fee.code);
    formData.set("concept", fee.concept);
    formData.set("section", fee.section);
    formData.set("costMxn", String(fee.costMxn));
    formData.set("isActive", String(!fee.isActive));

    startFeeTransition(async () => {
      const result = await upsertFeeAction(formData);
      if (result.ok) {
        setFeeFeedback({
          tone: "success",
          message: `${fee.concept} ${fee.isActive ? "se desactivó" : "se activó"} correctamente.`,
        });
        router.refresh();
      } else {
        setFeeFeedback({
          tone: "error",
          message: result.error ?? "No fue posible cambiar el estado.",
        });
      }
    });
  }

  function handleCampusSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCampusFeedback(null);

    const formData = new FormData(event.currentTarget);
    startCampusTransition(async () => {
      const result = await upsertCampusFeeAction(formData);
      if (result.ok) {
        setCampusFeedback({
          tone: "success",
          message: "Disponibilidad por plantel actualizada correctamente.",
        });
        setCampusEditor(null);
        router.refresh();
      } else {
        setCampusFeedback({
          tone: "error",
          message: result.error ?? "No fue posible guardar la disponibilidad.",
        });
      }
    });
  }

  function handleCampusToggle(fee: Fee, campusFee: CampusFee | undefined) {
    setCampusFeedback(null);
    const formData = new FormData();
    formData.set("campusId", selectedCampus);
    formData.set("academicFeeId", fee.id);
    formData.set("isActive", String(!(campusFee?.isActive ?? false)));
    formData.set(
      "overrideCostMxn",
      campusFee?.overrideCostMxn !== null && campusFee?.overrideCostMxn !== undefined
        ? String(campusFee.overrideCostMxn)
        : "",
    );

    startCampusTransition(async () => {
      const result = await upsertCampusFeeAction(formData);
      if (result.ok) {
        setCampusFeedback({
          tone: "success",
          message: `${fee.concept} ${campusFee?.isActive ? "se desactivó" : "se activó"} para ${campusName || "el plantel seleccionado"}.`,
        });
        router.refresh();
      } else {
        setCampusFeedback({
          tone: "error",
          message: result.error ?? "No fue posible cambiar el estado del plantel.",
        });
      }
    });
  }

  function handleMateriaSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMateriaFeedback(null);

    const formData = new FormData(event.currentTarget);
    startMateriaTransition(async () => {
      const result = await upsertMateriaAction(formData);
      if (result.ok) {
        setMateriaFeedback({
          tone: "success",
          message:
            materiaEditor?.mode === "edit"
              ? "Precio por materia actualizado correctamente."
              : "Precio por materia agregado correctamente.",
        });
        setMateriaEditor(null);
        router.refresh();
      } else {
        setMateriaFeedback({
          tone: "error",
          message: result.error ?? "No fue posible guardar el precio por materia.",
        });
      }
    });
  }

  return (
    <div className="grid gap-6">
      <div className="grid gap-3 md:grid-cols-4">
        {[
          { label: "Conceptos", value: feeStats.total, detail: `${feeStats.active} activos` },
          { label: "Secciones", value: feeStats.sections, detail: "Exámenes, trámites y diversos" },
          { label: "Planteles", value: campuses.length, detail: `${activeCampusFees} activaciones` },
          { label: "Materia", value: materias.length, detail: "Reglas de regreso" },
        ].map((item) => (
          <div key={item.label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <div className="text-xs uppercase tracking-[0.22em] text-slate-400">
              {item.label}
            </div>
            <div className="mt-2 text-2xl font-semibold text-slate-100">{item.value}</div>
            <div className="mt-1 text-xs text-slate-400">{item.detail}</div>
          </div>
        ))}
      </div>

      <AdminSegmentedTabs
        ariaLabel="Vistas de costos académicos"
        activeId={tab}
        onChange={(currentTab) => setTab(currentTab as Tab)}
        items={TAB_ORDER.map((currentTab) => ({
          id: currentTab,
          label: TAB_LABELS[currentTab],
        }))}
      />

      {tab === "fees" && (
        <div className="grid gap-4">
          <div className="grid gap-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
            <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="max-w-3xl">
              Catálogo maestro de cuotas. Aquí puedes buscar, filtrar, activar o editar costos
              puntuales. Para reemplazos masivos usa{" "}
              <span className="font-semibold text-slate-100">Seed desde JSON / CSV</span>.
            </div>
            <button
              type="button"
              onClick={() => {
                setFeeFeedback(null);
                setFeeEditor(buildFeeDraft());
              }}
              className="rounded-full border border-blue-900/40 bg-blue-950/20 px-4 py-2 text-sm text-emerald-100 transition hover:bg-blue-950/30"
            >
              Agregar uno
            </button>
            </div>
            <div className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_180px_180px]">
              <label className="grid gap-1 text-xs text-slate-400">
                Buscar
                <input
                  value={feeQuery}
                  onChange={(event) => setFeeQuery(event.target.value)}
                  className="ui-control"
                  placeholder="Código, concepto o sección"
                />
              </label>
              <label className="grid gap-1 text-xs text-slate-400">
                Sección
                <select
                  value={feeSectionFilter}
                  onChange={(event) => setFeeSectionFilter(event.target.value as FeeSection | "all")}
                  className="ui-control"
                >
                  <option value="all">Todas</option>
                  {Object.entries(SECTION_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-xs text-slate-400">
                Estado
                <select
                  value={feeStatusFilter}
                  onChange={(event) =>
                    setFeeStatusFilter(event.target.value as "all" | "active" | "inactive")
                  }
                  className="ui-control"
                >
                  <option value="all">Todos</option>
                  <option value="active">Activos</option>
                  <option value="inactive">Inactivos</option>
                </select>
              </label>
            </div>
          </div>

          <FeedbackBanner feedback={feeFeedback} />

          {feeEditor && (
            <div className="grid gap-4 rounded-2xl border border-white/10 bg-slate-950/30 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-100">
                    {feeEditor.mode === "edit" ? "Editar costo" : "Agregar costo"}
                  </div>
                  <div className="text-xs text-slate-400">
                    {feeEditor.mode === "edit"
                      ? "En edición individual solo se ajusta el valor del costo."
                      : "En altas individuales captura código, concepto, sección y costo."}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setFeeEditor(null)}
                  className="text-sm text-slate-400 transition hover:text-slate-200"
                >
                  Cancelar
                </button>
              </div>

              <form onSubmit={handleFeeSubmit} className="grid gap-4">
                <input type="hidden" name="id" value={feeEditor.id} />
                <input
                  type="hidden"
                  name="isActive"
                  value={feeEditor.isActive ? "true" : "false"}
                />

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="grid gap-2 text-sm">
                    Código
                    <input
                      name="code"
                      value={feeEditor.code}
                      onChange={(event) =>
                        setFeeEditor((current) =>
                          current ? { ...current, code: event.target.value } : current,
                        )
                      }
                      readOnly={feeEditor.mode === "edit"}
                      className="ui-control"
                    />
                  </label>

                  <label className="grid gap-2 text-sm">
                    Sección
                    <select
                      name="section"
                      value={feeEditor.section}
                      onChange={(event) =>
                        setFeeEditor((current) =>
                          current
                            ? { ...current, section: event.target.value as FeeSection }
                            : current,
                        )
                      }
                      disabled={feeEditor.mode === "edit"}
                      className="ui-control"
                    >
                      {Object.entries(SECTION_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className="grid gap-2 text-sm">
                  Concepto
                  <input
                    name="concept"
                    value={feeEditor.concept}
                    onChange={(event) =>
                      setFeeEditor((current) =>
                        current ? { ...current, concept: event.target.value } : current,
                      )
                    }
                    readOnly={feeEditor.mode === "edit"}
                    className="ui-control"
                  />
                </label>

                <label className="grid gap-2 text-sm md:max-w-xs">
                  Costo MXN
                  <input
                    type="number"
                    min="0"
                    step="1"
                    name="costMxn"
                    value={feeEditor.costMxn}
                    onChange={(event) =>
                      setFeeEditor((current) =>
                        current ? { ...current, costMxn: event.target.value } : current,
                      )
                    }
                    className="ui-control"
                  />
                </label>

                <div>
                  <button
                    type="submit"
                    disabled={feePending}
                    className="rounded-full border border-blue-900/40 bg-blue-950/20 px-4 py-2 text-sm text-emerald-100 transition hover:bg-blue-950/30 disabled:opacity-50"
                  >
                    {feePending ? "Guardando..." : "Guardar"}
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="text-sm text-slate-300">
            {visibleFees.length} de {fees.length} registro(s)
          </div>

          <div className="ui-scrollbar max-h-[620px] max-w-full overflow-auto rounded-2xl border border-white/10">
            <table className="w-full min-w-[860px] border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-slate-950/95 text-slate-300">
                <tr>
                  <th className="p-3 text-left font-semibold">Código</th>
                  <th className="p-3 text-left font-semibold">Concepto</th>
                  <th className="p-3 text-left font-semibold">Sección</th>
                  <th className="p-3 text-left font-semibold">Costo MXN</th>
                  <th className="p-3 text-left font-semibold">Activo</th>
                  <th className="p-3 text-left font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {visibleFees.map((fee) => (
                  <tr key={fee.id} className="border-t border-white/10">
                    <td className="p-3 font-mono text-xs text-slate-300">{fee.code}</td>
                    <td className="p-3 text-slate-100">{fee.concept}</td>
                    <td className="p-3">
                      <span className="rounded-full bg-slate-700/60 px-2 py-0.5 text-xs text-slate-300">
                        {SECTION_LABELS[fee.section]}
                      </span>
                    </td>
                    <td className="p-3 text-slate-100">{formatMoney(fee.costMxn)}</td>
                    <td className="p-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          fee.isActive
                            ? "bg-blue-950/15 text-emerald-200"
                            : "bg-slate-700/60 text-slate-400"
                        }`}
                      >
                        {fee.isActive ? "Sí" : "No"}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setFeeFeedback(null);
                            setFeeEditor(buildFeeDraft(fee));
                          }}
                          className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-slate-200 transition hover:bg-white/10"
                        >
                          Editar costo
                        </button>
                        <button
                          type="button"
                          onClick={() => handleFeeToggle(fee)}
                          disabled={feePending}
                          className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-slate-200 transition hover:bg-white/10 disabled:opacity-50"
                        >
                          {fee.isActive ? "Desactivar" : "Activar"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!visibleFees.length && (
                  <tr>
                    <td className="p-4 text-slate-300" colSpan={6}>
                      Sin registros para los filtros actuales.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "availability" && (
        <div className="grid gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
            Aquí puedes activar o desactivar un costo para un plantel y ajustar su valor
            individual. Para reemplazos masivos usa{" "}
            <span className="font-semibold text-slate-100">Seed desde JSON / CSV</span>.
          </div>

          <div className="grid max-w-sm gap-2 text-sm">
            Selecciona plantel
            <select
              value={selectedCampus}
              onChange={(event) => {
                setSelectedCampus(event.target.value);
                setCampusEditor(null);
                setCampusFeedback(null);
              }}
              className="ui-control"
            >
              {campuses.map((campus) => (
                <option key={campus.id} value={campus.id}>
                  {campus.name}
                </option>
              ))}
            </select>
          </div>

          <FeedbackBanner feedback={campusFeedback} />

          {campusEditor && (
            <div className="grid gap-4 rounded-2xl border border-white/10 bg-slate-950/30 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-100">
                    Editar costo para {campusName || "el plantel seleccionado"}
                  </div>
                  <div className="text-xs text-slate-400">
                    Si dejas vacío el costo de plantel, se usará el costo base.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setCampusEditor(null)}
                  className="text-sm text-slate-400 transition hover:text-slate-200"
                >
                  Cancelar
                </button>
              </div>

              <form onSubmit={handleCampusSubmit} className="grid gap-4">
                <input type="hidden" name="campusId" value={selectedCampus} />
                <input type="hidden" name="academicFeeId" value={campusEditor.academicFeeId} />
                <input
                  type="hidden"
                  name="isActive"
                  value={campusEditor.isActive ? "true" : "false"}
                />

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="grid gap-2 text-sm">
                    Concepto
                    <input value={campusEditor.concept} readOnly className="ui-control" />
                  </label>
                  <label className="grid gap-2 text-sm">
                    Sección
                    <input
                      value={SECTION_LABELS[campusEditor.section]}
                      readOnly
                      className="ui-control"
                    />
                  </label>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="grid gap-2 text-sm">
                    Costo base
                    <input
                      value={formatMoney(campusEditor.baseCostMxn)}
                      readOnly
                      className="ui-control"
                    />
                  </label>
                  <label className="grid gap-2 text-sm">
                    Costo plantel
                    <input
                      type="number"
                      min="0"
                      step="1"
                      name="overrideCostMxn"
                      value={campusEditor.overrideCostMxn}
                      onChange={(event) =>
                        setCampusEditor((current) =>
                          current
                            ? { ...current, overrideCostMxn: event.target.value }
                            : current,
                        )
                      }
                      className="ui-control"
                      placeholder={String(campusEditor.baseCostMxn)}
                    />
                  </label>
                </div>

                <div>
                  <button
                    type="submit"
                    disabled={campusPending || !selectedCampus}
                    className="rounded-full border border-blue-900/40 bg-blue-950/20 px-4 py-2 text-sm text-emerald-100 transition hover:bg-blue-950/30 disabled:opacity-50"
                  >
                    {campusPending ? "Guardando..." : "Guardar"}
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="ui-scrollbar max-h-[620px] max-w-full overflow-auto rounded-2xl border border-white/10">
            <table className="w-full min-w-[1120px] border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-slate-950/95 text-slate-300">
                <tr>
                  <th className="p-3 text-left font-semibold">Region</th>
                  <th className="p-3 text-left font-semibold">Plantel</th>
                  <th className="p-3 text-left font-semibold">Tier</th>
                  <th className="p-3 text-left font-semibold">Costo plantel</th>
                  <th className="p-3 text-left font-semibold">Concepto</th>
                  <th className="p-3 text-left font-semibold">Sección</th>
                  <th className="p-3 text-left font-semibold">Costo base</th>
                  <th className="p-3 text-left font-semibold">Activo en plantel</th>
                  <th className="p-3 text-left font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {fees.map((fee) => {
                  const campusFee = campusFeeMap[fee.id];
                  const isActive = campusFee?.isActive ?? false;
                  const effectiveCost = campusFee?.overrideCostMxn ?? fee.costMxn;

                  return (
                    <tr key={fee.id} className="border-t border-white/10">
                      <td className="p-3 text-slate-200">
                        {normalizeAdminPricingRegion(null)}
                      </td>
                      <td className="p-3 text-slate-100">
                        {selectedCampusRecord
                          ? formatAdminPricingPlantel({
                              plantel: selectedCampusRecord.name,
                              kind: selectedCampusRecord.kind,
                            })
                          : "Sin plantel"}
                      </td>
                      <td className="p-3 text-slate-200">
                        {selectedCampusRecord
                          ? formatAdminPricingTier({
                              plantel: selectedCampusRecord.name,
                              tier: selectedCampusRecord.tier,
                              kind: selectedCampusRecord.kind,
                            })
                          : "General"}
                      </td>
                      <td className="p-3 text-slate-100">{formatMoney(effectiveCost)}</td>
                      <td className="p-3 text-slate-100">{fee.concept}</td>
                      <td className="p-3">
                        <span className="rounded-full bg-slate-700/60 px-2 py-0.5 text-xs text-slate-300">
                          {SECTION_LABELS[fee.section]}
                        </span>
                      </td>
                      <td className="p-3 text-slate-200">{formatMoney(fee.costMxn)}</td>
                      <td className="p-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs ${
                            isActive
                              ? "bg-blue-950/15 text-emerald-200"
                              : "bg-slate-700/60 text-slate-400"
                          }`}
                        >
                          {isActive ? "Activo" : "Inactivo"}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setCampusFeedback(null);
                              setCampusEditor({
                                academicFeeId: fee.id,
                                concept: fee.concept,
                                section: fee.section,
                                baseCostMxn: fee.costMxn,
                                overrideCostMxn:
                                  campusFee?.overrideCostMxn !== null &&
                                  campusFee?.overrideCostMxn !== undefined
                                    ? String(campusFee.overrideCostMxn)
                                    : "",
                                isActive: campusFee?.isActive ?? true,
                              });
                            }}
                            className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-slate-200 transition hover:bg-white/10"
                          >
                            Editar costo
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCampusToggle(fee, campusFee)}
                            disabled={campusPending || !selectedCampus}
                            className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-slate-200 transition hover:bg-white/10 disabled:opacity-50"
                          >
                            {isActive ? "Desactivar" : "Activar"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!fees.length && (
                  <tr>
                    <td className="p-4 text-slate-300" colSpan={9}>
                      Sin costos académicos cargados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "materias" && (
        <div className="grid gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
            <div className="max-w-3xl">
              Aquí puedes agregar una fila individual y editar su costo. La carga masiva y la
              actualización completa siguen en{" "}
              <span className="font-semibold text-slate-100">Seed desde JSON / CSV</span>.
              <div className="mt-2 text-xs text-slate-400">
                Nota: este bloque hoy no tiene bandera de activo/inactivo en el modelo de
                datos, por eso aquí solo se expone alta individual y edición de costo.
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setMateriaFeedback(null);
                setMateriaEditor(buildMateriaDraft());
              }}
              className="rounded-full border border-blue-900/40 bg-blue-950/20 px-4 py-2 text-sm text-emerald-100 transition hover:bg-blue-950/30"
            >
              Agregar uno
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select
              value={materiaFilter}
              onChange={(event) => setMateriaFilter(event.target.value)}
              className="ui-control w-auto min-w-[220px] text-sm"
            >
              <option value="">Todos los planteles</option>
              {uniquePlanteles.map((plantel) => (
                <option key={plantel} value={plantel}>
                  {plantel}
                </option>
              ))}
            </select>
            <div className="text-sm text-slate-400">
              {visibleMaterias.length} registro(s) visibles
            </div>
          </div>

          <FeedbackBanner feedback={materiaFeedback} />

          {materiaEditor && (
            <div className="grid gap-4 rounded-2xl border border-white/10 bg-slate-950/30 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-100">
                    {materiaEditor.mode === "edit"
                      ? "Editar costo por materia"
                      : "Agregar precio por materia"}
                  </div>
                  <div className="text-xs text-slate-400">
                    {materiaEditor.mode === "edit"
                      ? "En edición individual solo se ajusta el costo."
                      : "Captura plantel, modalidad, número de materias y costo."}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setMateriaEditor(null)}
                  className="text-sm text-slate-400 transition hover:text-slate-200"
                >
                  Cancelar
                </button>
              </div>

              <form onSubmit={handleMateriaSubmit} className="grid gap-4">
                <input type="hidden" name="origPlantel" value={materiaEditor.origPlantel} />
                <input type="hidden" name="origModalidad" value={materiaEditor.origModalidad} />
                <input type="hidden" name="origMaterias" value={materiaEditor.origMaterias} />

                <div className="grid gap-4 md:grid-cols-3">
                  <label className="grid gap-2 text-sm">
                    Plantel
                    <input
                      name="plantel"
                      value={materiaEditor.plantel}
                      onChange={(event) =>
                        setMateriaEditor((current) =>
                          current ? { ...current, plantel: event.target.value } : current,
                        )
                      }
                      readOnly={materiaEditor.mode === "edit"}
                      className="ui-control"
                    />
                  </label>

                  <label className="grid gap-2 text-sm">
                    Modalidad
                    <select
                      name="modalidad"
                      value={materiaEditor.modalidad}
                      onChange={(event) =>
                        setMateriaEditor((current) =>
                          current ? { ...current, modalidad: event.target.value } : current,
                        )
                      }
                      disabled={materiaEditor.mode === "edit"}
                      className="ui-control"
                    >
                      {MODALITY_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="grid gap-2 text-sm">
                    # Materias
                    <input
                      type="number"
                      min="0"
                      step="1"
                      name="materias_count"
                      value={materiaEditor.materias_count}
                      onChange={(event) =>
                        setMateriaEditor((current) =>
                          current
                            ? { ...current, materias_count: event.target.value }
                            : current,
                        )
                      }
                      readOnly={materiaEditor.mode === "edit"}
                      className="ui-control"
                    />
                  </label>
                </div>

                <label className="grid gap-2 text-sm md:max-w-xs">
                  Costo MXN
                  <input
                    type="number"
                    min="0"
                    step="1"
                    name="costo"
                    value={materiaEditor.costo}
                    onChange={(event) =>
                      setMateriaEditor((current) =>
                        current ? { ...current, costo: event.target.value } : current,
                      )
                    }
                    className="ui-control"
                  />
                </label>

                <div>
                  <button
                    type="submit"
                    disabled={materiaPending}
                    className="rounded-full border border-blue-900/40 bg-blue-950/20 px-4 py-2 text-sm text-emerald-100 transition hover:bg-blue-950/30 disabled:opacity-50"
                  >
                    {materiaPending ? "Guardando..." : "Guardar"}
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="ui-scrollbar max-h-[620px] max-w-full overflow-auto rounded-2xl border border-white/10">
            <table className="w-full min-w-[920px] border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-slate-950/95 text-slate-300">
                <tr>
                  <th className="p-3 text-left font-semibold">Region</th>
                  <th className="p-3 text-left font-semibold">Plantel</th>
                  <th className="p-3 text-left font-semibold">Tier</th>
                  <th className="p-3 text-right font-semibold">Costo MXN</th>
                  <th className="p-3 text-left font-semibold">Modalidad</th>
                  <th className="p-3 text-right font-semibold"># Materias</th>
                  <th className="p-3 text-left font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {visibleMaterias.map((row, index) => (
                  <tr
                    key={`${row.plantel}-${row.modalidad}-${row.materias_count}-${index}`}
                    className="border-t border-white/10"
                  >
                    <td className="p-3 text-slate-200">
                      {normalizeAdminPricingRegion(row.region)}
                    </td>
                    <td className="p-3 text-slate-100">{row.plantel}</td>
                    <td className="p-3 text-slate-200">
                      {formatAdminPricingTier({
                        plantel: row.plantel,
                        tier: row.tier,
                        kind: row.kind,
                        modality: row.modalidad,
                      })}
                    </td>
                    <td className="p-3 text-right font-mono text-slate-100">
                      {formatMoney(Number(row.costo))}
                    </td>
                    <td className="p-3 text-slate-200">{row.modalidad}</td>
                    <td className="p-3 text-right font-mono text-slate-200">
                      {row.materias_count}
                    </td>
                    <td className="p-3">
                      <button
                        type="button"
                        onClick={() => {
                          setMateriaFeedback(null);
                          setMateriaEditor(buildMateriaDraft(row));
                        }}
                        className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-slate-200 transition hover:bg-white/10"
                      >
                        Editar costo
                      </button>
                    </td>
                  </tr>
                ))}
                {!visibleMaterias.length && (
                  <tr>
                    <td className="p-4 text-slate-400" colSpan={7}>
                      Sin registros.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "seed" && (
        <div className="grid gap-4">
          <div className="rounded-2xl border border-[#D7E4ED] bg-[#F7FBFD] px-4 py-3 text-sm text-[#123348]">
            Usa esta pestaña para cargas masivas de costos, activaciones, propiedades o
            actualizaciones completas en formato JSON o CSV. Para CSV con encabezados, no importa
            el orden de columnas mientras existan código, concepto, sección y costo.
          </div>

          <div className="grid gap-3">
            <div className="text-sm font-semibold text-[#123348]">Qué quieres modificar</div>
            <div className="flex flex-wrap gap-2">
              {(["fees", "campus", "materias"] as SeedMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => changeSeedMode(mode)}
                  className={`rounded-full px-4 py-2 text-sm transition ${
                    seedMode === mode
                      ? "border border-[#114E6D] bg-[#114E6D] text-white"
                      : "border border-[#D7E4ED] bg-white text-[#123348] hover:bg-[#F4F9FC]"
                  }`}
                >
                  {SEED_MODE_LABELS[mode]}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3">
            <div className="text-sm font-semibold text-[#123348]">Formato de entrada</div>
            <div className="flex flex-wrap gap-2">
              {(["json", "csv"] as SeedFormat[]).map((format) => (
                <button
                  key={format}
                  type="button"
                  onClick={() => changeSeedFormat(format)}
                  className={`rounded-full px-4 py-2 text-sm uppercase transition ${
                    seedFormat === format
                      ? "border border-[#114E6D] bg-[#114E6D] text-white"
                      : "border border-[#D7E4ED] bg-white text-[#123348] hover:bg-[#F4F9FC]"
                  }`}
                >
                  {format}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-[#D7E4ED] bg-white px-4 py-4 text-sm text-[#657D8F]">
            <div className="font-semibold text-[#123348]">{seedGuide.title}</div>
            <div className="mt-2">{seedGuide.detail}</div>
            <pre className="mt-3 overflow-x-auto rounded-xl border border-[#D7E4ED] bg-[#F4F9FC] p-3 text-xs text-[#123348]">
              {seedGuide.sample}
            </pre>
          </div>

          {seedMode === "campus" && seedFormat === "csv" && (
            <div className="grid max-w-sm gap-2 text-sm">
              Plantel a reemplazar
              <select
                value={selectedCampus}
                onChange={(event) => setSelectedCampus(event.target.value)}
                className="ui-control"
              >
                {campuses.map((campus) => (
                  <option key={campus.id} value={campus.id}>
                    {campus.name}
                  </option>
                ))}
              </select>
              <div className="text-xs text-amber-200">
                El CSV se aplicará sobre <span className="font-semibold">{campusName}</span>.
                Las filas incluidas quedarán activas y las faltantes se marcarán como
                inactivas.
              </div>
            </div>
          )}

          <form onSubmit={handleSeedSubmit} className="grid gap-3">
            <div className="grid gap-2 text-sm">
              Archivo opcional (.json o .csv)
              <input
                type="file"
                accept=".json,.csv,application/json,text/csv"
                onChange={(event) => void handleSeedFileSelection(event)}
                className="ui-control"
              />
              {seedFileName && (
                <div className="text-xs text-slate-400">Archivo cargado: {seedFileName}</div>
              )}
            </div>

            <div className="grid gap-2 text-sm">
              Contenido {seedFormat.toUpperCase()}
              <textarea
                value={seedPayload}
                onChange={(event) => setSeedPayload(event.target.value)}
                rows={14}
                className="ui-control font-mono text-xs"
                placeholder={seedGuide.placeholder}
              />
              <div className="text-xs text-slate-400">
                Puedes pegar el contenido manualmente o cargar un archivo para que se copie
                aquí.
              </div>
            </div>

            {seedPayload.trim() ? (
              <div className="grid gap-3 rounded-2xl border border-[#D7E4ED] bg-white px-4 py-3 text-sm text-[#123348]">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-[0.22em] text-[#657D8F]">
                      Preview antes de aplicar
                    </div>
                    <div className="mt-1 font-semibold">
                      {seedPreview.rows} fila{seedPreview.rows === 1 ? "" : "s"} detectada
                      {seedPreview.rows === 1 ? "" : "s"}
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      seedPreview.ok
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {seedPreview.ok ? "Lista para aplicar" : "Revisar archivo"}
                  </span>
                </div>
                {seedPreview.errors.length ? (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                    {seedPreview.errors[0]}
                  </div>
                ) : null}
                {seedPreview.sample.length ? (
                  <div className="ui-table-wrap ui-table-wrap--scroll-y ui-scrollbar max-h-52">
                    <table className="ui-table ui-table--compact w-full min-w-[640px]">
                      <tbody>
                        {seedPreview.sample.map((row, rowIndex) => (
                          <tr key={`${rowIndex}-${row.join("|")}`}>
                            <td className="ui-cell-nowrap text-xs text-[#657D8F]">
                              {rowIndex + 1}
                            </td>
                            <td className="text-xs text-[#123348]">
                              {row.join(" | ")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </div>
            ) : null}

            {seedError && (
              <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300">
                {seedError}
              </div>
            )}

            {seedResult && (
              <div className="rounded-2xl border border-blue-900/40 bg-blue-950/20 px-4 py-3 text-sm text-emerald-200">
                <div className="font-semibold">Importación masiva completada</div>
                {seedResult.created !== undefined && (
                  <div className="mt-1">Creados: {seedResult.created}</div>
                )}
                {seedResult.updated !== undefined && (
                  <div>Actualizados: {seedResult.updated}</div>
                )}
                {seedResult.activated !== undefined && (
                  <div className="mt-1">Activados: {seedResult.activated}</div>
                )}
                {seedResult.deactivated !== undefined && (
                  <div>Desactivados: {seedResult.deactivated}</div>
                )}
                {seedResult.errors && seedResult.errors.length > 0 && (
                  <div className="mt-2">
                    <div className="text-yellow-300">
                      Errores parciales ({seedResult.errors.length}):
                    </div>
                    <ul className="mt-1 list-inside list-disc text-xs text-yellow-200">
                      {seedResult.errors.map((error, index) => (
                        <li key={`${error}-${index}`}>{error}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={
                  seedPending ||
                  !seedPayload.trim() ||
                  !seedPreview.ok ||
                  (seedMode === "campus" && seedFormat === "csv" && !selectedCampus)
                }
                className="rounded-full border border-blue-900/40 bg-blue-950/20 px-4 py-2 text-sm text-emerald-100 transition hover:bg-blue-950/30 disabled:opacity-50"
              >
                {seedPending ? "Procesando..." : "Ejecutar importación masiva"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
