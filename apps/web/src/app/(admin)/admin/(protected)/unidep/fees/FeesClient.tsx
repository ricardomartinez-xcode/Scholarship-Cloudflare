"use client";

import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import AdminSegmentedTabs from "@/components/admin/AdminSegmentedTabs";
import {
  compareAdminPricingScope,
  formatAdminPricingPlantel,
  formatAdminPricingTier,
  normalizeAdminPricingRegion,
} from "@/lib/admin-pricing-display";
import {
  seedMateriasImportAction,
  seedUnifiedFeesCsvAction,
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
type SeedMode = "unified" | "materias";
type SeedFormat = "csv";
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
  headers: string[];
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

const TAB_ORDER = ["fees", "materias", "seed"] as const;

const TAB_LABELS: Record<Exclude<Tab, "availability">, string> = {
  fees: "Trámites + plantel",
  materias: "Precio por materia",
  seed: "Importación",
};

const SEED_MODE_LABELS: Record<SeedMode, string> = {
  unified: "Trámites + plantel",
  materias: "Precio por materia",
};

const MODALITY_OPTIONS = ["presencial", "mixta", "online"] as const;

function formatMoney(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "N/A";
  }
  return `$${Number(value).toLocaleString("es-MX")}`;
}

function getSeedGuide(mode: SeedMode) {
  if (mode === "unified") {
    return {
      title: "Importa Trámites + Plantel en un solo CSV.",
      detail:
        "Una fila crea/actualiza el costo base y su disponibilidad/costo por plantel. Usa los mismos campos visibles en la tabla Trámites + plantel.",
      sample:
        "codigo,concepto,seccion,costo_base,plantel,costo_plantel,activo_plantel\nEX001,Examen ordinario,EXAMENES,150,Chihuahua,150,true\nTR001,Titulación,TRAMITES,2500,Online,,true",
      placeholder:
        "codigo,concepto,seccion,costo_base,plantel,costo_plantel,activo_plantel",
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
  payload: string;
}): SeedPreview {
  const payload = params.payload.trim();
  if (!payload) {
    return { ok: false, rows: 0, errors: ["Carga o pega contenido primero."], headers: [], sample: [] };
  }

  const rows = parsePreviewCsv(payload);
  if (!rows.length) {
    return { ok: false, rows: 0, errors: ["El CSV no contiene filas."], headers: [], sample: [] };
  }
  const firstRow = rows[0] ?? [];
  const hasHeader = previewHasHeader(firstRow);
  const dataRows = rows.slice(hasHeader ? 1 : 0).filter((row) =>
    row.some((cell) => String(cell ?? "").trim()),
  );

  const required =
    params.mode === "unified"
      ? ["codigo", "concepto", "seccion", "costobase", "plantel"]
      : ["plantel", "modalidad", "materias", "costomxn"];
  const normalizedHeader = firstRow.map(normalizePreviewHeader);
  const missing = hasHeader
    ? required.filter((header) => !normalizedHeader.includes(header))
    : [];

  return {
    ok: dataRows.length > 0 && missing.length === 0,
    rows: dataRows.length,
    errors: [
      ...(dataRows.length ? [] : ["El CSV no contiene filas de datos."]),
      ...(missing.length ? [`Faltan columnas: ${missing.join(", ")}.`] : []),
    ],
    headers: hasHeader ? firstRow : [],
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
  const [seedMode, setSeedMode] = useState<SeedMode>("unified");
  const [seedFormat] = useState<SeedFormat>("csv");
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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("tab") === "seed") setTab("seed");
    const nextSeedMode = params.get("seedMode");
    if (nextSeedMode === "unified" || nextSeedMode === "materias") {
      setSeedMode(nextSeedMode);
    }
  }, []);

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
  const seedGuide = getSeedGuide(seedMode);
  const seedPreview = useMemo(
    () => buildSeedPreview({ mode: seedMode, payload: seedPayload }),
    [seedMode, seedPayload],
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

  async function handleSeedFileSelection(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const extension = file.name.toLowerCase().split(".").pop();
      if (extension !== "csv") {
        throw new Error("Formato no soportado. Usa archivos .csv.");
      }

      const text = await file.text();
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

    startSeedTransition(async () => {
      const result = (
        seedMode === "unified"
          ? await seedUnifiedFeesCsvAction(formData)
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
          <div key={item.label} className="rounded-2xl border border-[#D7E4ED] bg-white p-4">
            <div className="text-xs uppercase tracking-[0.22em] text-[#657D8F]">
              {item.label}
            </div>
            <div className="mt-2 text-2xl font-semibold text-[#123348]">{item.value}</div>
            <div className="mt-1 text-xs text-[#4B6475]">{item.detail}</div>
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
          <div className="grid gap-4 rounded-2xl border border-[#D7E4ED] bg-[#F7FBFD] px-4 py-3 text-sm text-[#123348]">
            <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="max-w-3xl">
              Catálogo maestro de cuotas. Aquí puedes buscar, filtrar, activar o editar costos
              puntuales. Para reemplazos masivos usa{" "}
              <span className="font-semibold text-[#123348]">Importación CSV</span>.
            </div>
            <button
              type="button"
              onClick={() => {
                setFeeFeedback(null);
                setFeeEditor(buildFeeDraft());
              }}
              className="rounded-full border border-[#114E6D] bg-[#114E6D] px-4 py-2 text-sm text-white transition hover:bg-[#0D405A]"
            >
              Agregar uno
            </button>
            </div>
            <div className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_180px_180px_minmax(220px,260px)]">
              <label className="grid gap-1 text-xs font-medium text-[#38566A]">
                Buscar
                <input
                  value={feeQuery}
                  onChange={(event) => setFeeQuery(event.target.value)}
                  className="ui-control"
                  placeholder="Código, concepto o sección"
                />
              </label>
              <label className="grid gap-1 text-xs font-medium text-[#38566A]">
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
              <label className="grid gap-1 text-xs font-medium text-[#38566A]">
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
              <label className="grid gap-1 text-xs font-medium text-[#38566A]">
                Plantel
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
              </label>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-[#4B6475]">
              <button
                type="button"
                onClick={() => {
                  changeSeedMode("unified");
                  setTab("seed");
                }}
                className="rounded-full border border-[#D7E4ED] bg-white px-3 py-1 text-[#123348] transition hover:bg-[#EEF6FA]"
              >
                Importar Trámites + plantel
              </button>
            </div>
          </div>

          <FeedbackBanner feedback={feeFeedback} />
          <FeedbackBanner feedback={campusFeedback} />

          {feeEditor && (
            <div className="grid gap-4 rounded-2xl border border-[#D7E4ED] bg-white p-4 text-[#123348]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-[#123348]">
                    {feeEditor.mode === "edit" ? "Editar costo" : "Agregar costo"}
                  </div>
                  <div className="text-xs text-[#4B6475]">
                    {feeEditor.mode === "edit"
                      ? "En edición individual solo se ajusta el valor del costo."
                      : "En altas individuales captura código, concepto, sección y costo."}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setFeeEditor(null)}
                  className="text-sm text-[#4B6475] transition hover:text-[#123348]"
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
                    className="rounded-full border border-[#114E6D] bg-[#114E6D] px-4 py-2 text-sm text-white transition hover:bg-[#0D405A] disabled:bg-slate-200 disabled:text-slate-500"
                  >
                    {feePending ? "Guardando..." : "Guardar"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {campusEditor && (
            <div className="grid gap-4 rounded-2xl border border-[#D7E4ED] bg-white p-4 text-[#123348]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-[#123348]">
                    Editar costo para {campusName || "el plantel seleccionado"}
                  </div>
                  <div className="text-xs text-[#4B6475]">
                    Si dejas vacío el costo de plantel, se usará el costo base.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setCampusEditor(null)}
                  className="text-sm text-[#4B6475] transition hover:text-[#123348]"
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
                    className="rounded-full border border-[#114E6D] bg-[#114E6D] px-4 py-2 text-sm text-white transition hover:bg-[#0D405A] disabled:bg-slate-200 disabled:text-slate-500"
                  >
                    {campusPending ? "Guardando..." : "Guardar costo plantel"}
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="text-sm text-[#38566A]">
            {visibleFees.length} de {fees.length} registro(s) para{" "}
            <span className="font-semibold text-[#123348]">{campusName || "plantel"}</span>
          </div>

          <div className="ui-scrollbar max-h-[620px] max-w-full overflow-auto rounded-2xl border border-[#D7E4ED] bg-white">
            <table className="w-full min-w-[1120px] border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-[#114E6D] text-white">
                <tr>
                  <th className="p-3 text-left font-semibold">Código</th>
                  <th className="p-3 text-left font-semibold">Concepto</th>
                  <th className="p-3 text-left font-semibold">Sección</th>
                  <th className="p-3 text-left font-semibold">Costo base</th>
                  <th className="p-3 text-left font-semibold">Plantel</th>
                  <th className="p-3 text-left font-semibold">Costo plantel</th>
                  <th className="p-3 text-left font-semibold">Activo general</th>
                  <th className="p-3 text-left font-semibold">Activo plantel</th>
                  <th className="p-3 text-left font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {visibleFees.map((fee) => {
                  const campusFee = campusFeeMap[fee.id];
                  const isCampusActive = campusFee?.isActive ?? false;
                  const effectiveCost = campusFee?.overrideCostMxn ?? fee.costMxn;

                  return (
                    <tr key={fee.id} className="border-t border-[#D7E4ED] text-[#123348] hover:bg-[#F7FBFD]">
                      <td className="p-3 font-mono text-xs font-semibold text-[#38566A]">{fee.code}</td>
                      <td className="p-3 font-medium text-[#123348]">{fee.concept}</td>
                      <td className="p-3">
                        <span className="rounded-full bg-[#E8F1F6] px-2 py-0.5 text-xs font-medium text-[#38566A]">
                          {SECTION_LABELS[fee.section]}
                        </span>
                      </td>
                      <td className="p-3 font-medium text-[#123348]">{formatMoney(fee.costMxn)}</td>
                      <td className="p-3 text-[#123348]">
                        {selectedCampusRecord
                          ? formatAdminPricingPlantel({
                              plantel: selectedCampusRecord.name,
                              kind: selectedCampusRecord.kind,
                            })
                          : "Sin plantel"}
                      </td>
                      <td className="p-3 font-medium text-[#123348]">{formatMoney(effectiveCost)}</td>
                      <td className="p-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs ${
                            fee.isActive
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-slate-200 text-slate-700"
                          }`}
                        >
                          {fee.isActive ? "Sí" : "No"}
                        </span>
                      </td>
                      <td className="p-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs ${
                            isCampusActive
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-slate-200 text-slate-700"
                          }`}
                        >
                          {isCampusActive ? "Activo" : "Inactivo"}
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
                            className="rounded-full border border-[#D7E4ED] bg-white px-3 py-1 text-xs font-medium text-[#123348] transition hover:bg-[#EEF6FA]"
                          >
                            Editar base
                          </button>
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
                            disabled={!selectedCampus}
                            className="rounded-full border border-[#D7E4ED] bg-white px-3 py-1 text-xs font-medium text-[#123348] transition hover:bg-[#EEF6FA] disabled:bg-slate-100 disabled:text-slate-500"
                          >
                            Editar plantel
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCampusToggle(fee, campusFee)}
                            disabled={campusPending || !selectedCampus}
                            className="rounded-full border border-[#D7E4ED] bg-white px-3 py-1 text-xs font-medium text-[#123348] transition hover:bg-[#EEF6FA] disabled:bg-slate-100 disabled:text-slate-500"
                          >
                            {isCampusActive ? "Desactivar plantel" : "Activar plantel"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleFeeToggle(fee)}
                            disabled={feePending}
                            className="rounded-full border border-[#D7E4ED] bg-white px-3 py-1 text-xs font-medium text-[#123348] transition hover:bg-[#EEF6FA] disabled:bg-slate-100 disabled:text-slate-500"
                          >
                            {fee.isActive ? "Desactivar base" : "Activar base"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!visibleFees.length && (
                  <tr>
                    <td className="p-4 text-[#4B6475]" colSpan={9}>
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
          <div className="rounded-2xl border border-[#D7E4ED] bg-[#F7FBFD] px-4 py-3 text-sm text-[#123348]">
            Aquí puedes activar o desactivar un costo para un plantel y ajustar su valor
            individual. Para reemplazos masivos usa{" "}
            <span className="font-semibold text-[#123348]">Importación CSV</span>.
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
            <div className="grid gap-4 rounded-2xl border border-[#D7E4ED] bg-white p-4 text-[#123348]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-[#123348]">
                    Editar costo para {campusName || "el plantel seleccionado"}
                  </div>
                  <div className="text-xs text-[#4B6475]">
                    Si dejas vacío el costo de plantel, se usará el costo base.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setCampusEditor(null)}
                  className="text-sm text-[#4B6475] transition hover:text-[#123348]"
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
                    className="rounded-full border border-[#114E6D] bg-[#114E6D] px-4 py-2 text-sm text-white transition hover:bg-[#0D405A] disabled:bg-slate-200 disabled:text-slate-500"
                  >
                    {campusPending ? "Guardando..." : "Guardar"}
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="ui-scrollbar max-h-[620px] max-w-full overflow-auto rounded-2xl border border-[#D7E4ED] bg-white">
            <table className="w-full min-w-[1120px] border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-[#114E6D] text-white">
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
                    <tr key={fee.id} className="border-t border-[#D7E4ED] text-[#123348] hover:bg-[#F7FBFD]">
                      <td className="p-3 text-[#38566A]">
                        {normalizeAdminPricingRegion(null)}
                      </td>
                      <td className="p-3 font-medium text-[#123348]">
                        {selectedCampusRecord
                          ? formatAdminPricingPlantel({
                              plantel: selectedCampusRecord.name,
                              kind: selectedCampusRecord.kind,
                            })
                          : "Sin plantel"}
                      </td>
                      <td className="p-3 text-[#38566A]">
                        {selectedCampusRecord
                          ? formatAdminPricingTier({
                              plantel: selectedCampusRecord.name,
                              tier: selectedCampusRecord.tier,
                              kind: selectedCampusRecord.kind,
                            })
                          : "General"}
                      </td>
                      <td className="p-3 font-medium text-[#123348]">{formatMoney(effectiveCost)}</td>
                      <td className="p-3 font-medium text-[#123348]">{fee.concept}</td>
                      <td className="p-3">
                        <span className="rounded-full bg-[#E8F1F6] px-2 py-0.5 text-xs font-medium text-[#38566A]">
                          {SECTION_LABELS[fee.section]}
                        </span>
                      </td>
                      <td className="p-3 text-[#38566A]">{formatMoney(fee.costMxn)}</td>
                      <td className="p-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs ${
                            isActive
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-slate-200 text-slate-700"
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
                            className="rounded-full border border-[#D7E4ED] bg-white px-3 py-1 text-xs font-medium text-[#123348] transition hover:bg-[#EEF6FA]"
                          >
                            Editar costo
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCampusToggle(fee, campusFee)}
                            disabled={campusPending || !selectedCampus}
                            className="rounded-full border border-[#D7E4ED] bg-white px-3 py-1 text-xs font-medium text-[#123348] transition hover:bg-[#EEF6FA] disabled:bg-slate-100 disabled:text-slate-500"
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
                    <td className="p-4 text-[#4B6475]" colSpan={9}>
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
          <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-[#D7E4ED] bg-[#F7FBFD] px-4 py-3 text-sm text-[#123348]">
            <div className="max-w-3xl">
              Aquí puedes agregar una fila individual y editar su costo. La carga masiva y la
              actualización completa siguen en{" "}
              <span className="font-semibold text-[#123348]">Importación CSV</span>.
              <div className="mt-2 text-xs text-[#4B6475]">
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
              className="rounded-full border border-[#114E6D] bg-[#114E6D] px-4 py-2 text-sm text-white transition hover:bg-[#0D405A]"
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
            <div className="text-sm text-[#4B6475]">
              {visibleMaterias.length} registro(s) visibles
            </div>
          </div>

          <FeedbackBanner feedback={materiaFeedback} />

          {materiaEditor && (
            <div className="grid gap-4 rounded-2xl border border-[#D7E4ED] bg-white p-4 text-[#123348]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-[#123348]">
                    {materiaEditor.mode === "edit"
                      ? "Editar costo por materia"
                      : "Agregar precio por materia"}
                  </div>
                  <div className="text-xs text-[#4B6475]">
                    {materiaEditor.mode === "edit"
                      ? "En edición individual solo se ajusta el costo."
                      : "Captura plantel, modalidad, número de materias y costo."}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setMateriaEditor(null)}
                  className="text-sm text-[#4B6475] transition hover:text-[#123348]"
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
                    className="rounded-full border border-[#114E6D] bg-[#114E6D] px-4 py-2 text-sm text-white transition hover:bg-[#0D405A] disabled:bg-slate-200 disabled:text-slate-500"
                  >
                    {materiaPending ? "Guardando..." : "Guardar"}
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="ui-scrollbar max-h-[620px] max-w-full overflow-auto rounded-2xl border border-[#D7E4ED] bg-white">
            <table className="w-full min-w-[920px] border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-[#114E6D] text-white">
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
                    className="border-t border-[#D7E4ED] text-[#123348] hover:bg-[#F7FBFD]"
                  >
                    <td className="p-3 text-[#38566A]">
                      {normalizeAdminPricingRegion(row.region)}
                    </td>
                    <td className="p-3 font-medium text-[#123348]">{row.plantel}</td>
                    <td className="p-3 text-[#38566A]">
                      {formatAdminPricingTier({
                        plantel: row.plantel,
                        tier: row.tier,
                        kind: row.kind,
                        modality: row.modalidad,
                      })}
                    </td>
                    <td className="p-3 text-right font-mono font-semibold text-[#123348]">
                      {formatMoney(Number(row.costo))}
                    </td>
                    <td className="p-3 text-[#38566A]">{row.modalidad}</td>
                    <td className="p-3 text-right font-mono text-[#38566A]">
                      {row.materias_count}
                    </td>
                    <td className="p-3">
                      <button
                        type="button"
                        onClick={() => {
                          setMateriaFeedback(null);
                          setMateriaEditor(buildMateriaDraft(row));
                        }}
                        className="rounded-full border border-[#D7E4ED] bg-white px-3 py-1 text-xs font-medium text-[#123348] transition hover:bg-[#EEF6FA]"
                      >
                        Editar costo
                      </button>
                    </td>
                  </tr>
                ))}
                {!visibleMaterias.length && (
                  <tr>
                    <td className="p-4 text-[#4B6475]" colSpan={7}>
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
            Usa CSV para cargar costos base y disponibilidad por plantel en una sola operación.
            El preview valida columnas mínimas antes de aplicar cambios.
          </div>

          <div className="grid gap-3">
            <div className="text-sm font-semibold text-[#123348]">Qué quieres modificar</div>
            <div className="flex flex-wrap gap-2">
              {(["unified", "materias"] as SeedMode[]).map((mode) => (
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

          <div className="rounded-2xl border border-[#D7E4ED] bg-white px-4 py-4 text-sm text-[#657D8F]">
            <div className="font-semibold text-[#123348]">{seedGuide.title}</div>
            <div className="mt-2">{seedGuide.detail}</div>
            <pre className="mt-3 overflow-x-auto rounded-xl border border-[#D7E4ED] bg-[#F4F9FC] p-3 text-xs text-[#123348]">
              {seedGuide.sample}
            </pre>
          </div>

          <form onSubmit={handleSeedSubmit} className="grid gap-3">
            <div className="grid gap-2 text-sm">
              Archivo opcional (.csv)
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(event) => void handleSeedFileSelection(event)}
                className="ui-control"
              />
              {seedFileName && (
                <div className="text-xs text-[#4B6475]">Archivo cargado: {seedFileName}</div>
              )}
            </div>

            <div className="grid gap-2 text-sm">
              Contenido CSV
              <textarea
                value={seedPayload}
                onChange={(event) => setSeedPayload(event.target.value)}
                rows={14}
                className="ui-control font-mono text-xs"
                placeholder={seedGuide.placeholder}
              />
              <div className="text-xs text-[#4B6475]">
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
                  <div className="ui-table-wrap ui-table-wrap--scroll-y ui-scrollbar max-h-72 overflow-auto">
                    <table className="ui-table ui-table--compact w-full min-w-[760px] table-fixed">
                      {seedPreview.headers.length ? (
                        <thead>
                          <tr>
                            <th className="w-12 text-left text-xs text-[#657D8F]">#</th>
                            {seedPreview.headers.map((header, index) => (
                              <th
                                key={`${header}-${index}`}
                                className="text-left text-xs text-[#657D8F]"
                              >
                                {header}
                              </th>
                            ))}
                          </tr>
                        </thead>
                      ) : null}
                      <tbody>
                        {seedPreview.sample.map((row, rowIndex) => (
                          <tr key={`${rowIndex}-${row.join("|")}`}>
                            <td className="ui-cell-nowrap w-12 text-xs text-[#657D8F]">
                              {rowIndex + 1}
                            </td>
                            {(seedPreview.headers.length ? row : [row.join(" | ")]).map(
                              (cell, cellIndex) => (
                                <td
                                  key={`${rowIndex}-${cellIndex}`}
                                  className="whitespace-normal break-words text-xs text-[#123348]"
                                >
                                  {cell}
                                </td>
                              ),
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </div>
            ) : null}

            {seedError && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
                {seedError}
              </div>
            )}

            {seedResult && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
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
                    <div className="text-amber-700">
                      Errores parciales ({seedResult.errors.length}):
                    </div>
                    <ul className="mt-1 list-inside list-disc text-xs text-amber-700">
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
                  !seedPreview.ok
                }
                className="rounded-full border border-[#114E6D] bg-[#114E6D] px-4 py-2 text-sm text-white transition hover:bg-[#0D405A] disabled:opacity-50"
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
