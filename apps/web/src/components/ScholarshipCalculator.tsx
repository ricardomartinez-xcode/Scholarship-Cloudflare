"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import SmartSelect from "@/components/SmartSelect";
import AnnouncementOutlet, {
  type Announcement,
} from "@/components/announcement/AnnouncementOutlet";
import { useAppContext } from "@/components/app/AppChrome";
import ConfiguredCtaList from "@/components/cta/ConfiguredCtaList";
import { useSimulator } from "@/components/simulator/SimulatorProvider";
import FloatingCalculator from "@/components/unidep/FloatingCalculator";
import ResultsWhatsappTemplatePanel from "@/components/whatsapp/ResultsWhatsappTemplatePanel";
import {
  formatBenefitDurationLabel,
  formatBenefitDurationSentence,
} from "@/lib/benefit-duration";
import {
  buildSimulatorFingerprint,
  type SimulatorInputSnapshot,
  type SimulatorResultSnapshot,
} from "@/lib/simulator-types";
import type {
  WhatsappTemplateCollection,
  WhatsappTemplatePreviewData,
} from "@/lib/whatsapp-templates";
import type { AcademicOfferCycle } from "@/config/academicOffer";
 
const MAX_BECA_REGRESO = 25;
const QUOTE_DEBOUNCE_MS = 300;
 
type TipoInscripcion = "nuevo_ingreso" | "regreso" | "reingreso";
 
type FlatRule = {
  programa: string;
  nivel: string;
  modalidad: string;
  plan: number;
  tier?: string | null;
  rango?: { min: number; max: number } | null;
  porcentaje?: number | null;
  monto?: number | null;
  origen?: string | null;
};
 
type MetaPlantel = {
  tier?: string | null;
  oferta?: Record<string, Record<string, { neto?: number }>>;
};
 
type MetaResponse = {
  version?: string;
  planteles?: Record<string, MetaPlantel>;
};
 
type RegresoResponse = {
  materias?: Record<string, Record<string, Record<string, number>>>;
};
 
type CalculationOk = {
  base: number;
  porcentaje: number;
  montoFinal: number;
  sinAccesoBeca: boolean;
  tier: string | null;
  plantelKey: string;
  subtotalMxn?: number;
  totalMxn?: number;
  scholarshipAmountMxn?: number;
  additionalBenefitPercent?: number;
  additionalBenefitNotes?: string | null;
  additionalBenefitDuration?: string | null;
  additionalBenefitAmountMxn?: number;
  firstPaymentAmountMxn?: number;
  firstPaymentNotes?: string | null;
  firstPaymentDuration?: string | null;
};
 
type CalculationErr = {
  error: string;
  hint?: string;
  missing?: Array<
    | "nivel"
    | "modalidad"
    | "plan"
    | "modulo"
    | "plantel"
    | "materias"
    | "promedio"
    | "cargoType"
    | "cargoAmount"
  >;
  ranges?: string[];
};

const QUOTE_MISSING_FIELD_LABELS: Record<string, string> = {
  enrollmentType: "tipo de inscripción",
  businessLine: "línea de negocio",
  modality: "modalidad",
  plan: "plan de estudios",
  campus: "plantel",
  average: "promedio",
  subjectCount: "materias",
  extraCharge: "cargo académico",
};

const QUOTE_MISSING_FIELD_MAP: Record<string, NonNullable<CalculationErr["missing"]>[number]> = {
  businessLine: "nivel",
  modality: "modalidad",
  plan: "plan",
  campus: "plantel",
  average: "promedio",
  subjectCount: "materias",
};

function normalizeQuoteError(result: Extract<QuoteApiResult, { ok: false }>): CalculationErr {
  if (result.error === "missing_fields") {
    const missing = result.missing ?? [];
    const labels = missing.map((field) => QUOTE_MISSING_FIELD_LABELS[field] ?? field);

    return {
      error: "Faltan campos obligatorios.",
      hint: labels.length ? `Completa: ${labels.join(", ")}.` : result.hint,
      missing: missing
        .map((field) => QUOTE_MISSING_FIELD_MAP[field])
        .filter((field): field is NonNullable<CalculationErr["missing"]>[number] => Boolean(field)),
      ranges: result.ranges,
    };
  }

  if (result.error === "invalid_payload") {
    return {
      error: "Hay campos con valores inválidos.",
      hint: result.hint,
      missing: result.missing
        ?.map((field) => QUOTE_MISSING_FIELD_MAP[field])
        .filter((field): field is NonNullable<CalculationErr["missing"]>[number] => Boolean(field)),
      ranges: result.ranges,
    };
  }

  return {
    error: result.error,
    hint: result.hint,
    missing: result.missing as CalculationErr["missing"],
    ranges: result.ranges,
  };
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fill: string,
  stroke?: string,
) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  font: string,
) {
  ctx.font = font;
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";

  const pushSplitWord = (word: string) => {
    let chunk = "";
    for (const char of word) {
      const next = `${chunk}${char}`;
      if (ctx.measureText(next).width <= maxWidth || !chunk) {
        chunk = next;
        continue;
      }
      lines.push(chunk);
      chunk = char;
    }
    if (chunk) line = chunk;
  };

  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth || !line) {
      if (!line && ctx.measureText(word).width > maxWidth) {
        pushSplitWord(word);
      } else {
        line = next;
      }
      continue;
    }
    lines.push(line);
    line = "";
    if (ctx.measureText(word).width > maxWidth) {
      pushSplitWord(word);
    } else {
      line = word;
    }
  }

  if (line) lines.push(line);
  return lines;
}

function fitCanvasFontSize(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  fontFamily: string,
  options: { max: number; min: number; weight?: number } = { max: 52, min: 34 },
) {
  for (let size = options.max; size >= options.min; size -= 1) {
    const font = `${options.weight ?? 800} ${size}px ${fontFamily}`;
    ctx.font = font;
    if (ctx.measureText(text).width <= maxWidth) return { font, size };
  }
  return {
    font: `${options.weight ?? 800} ${options.min}px ${fontFamily}`,
    size: options.min,
  };
}
 
type BenefitInfo = {
  extraPercent: number;
  firstPaymentAmount: number;
  notes: string | null;
  appliesToAll: boolean;
  duration: string | null;
};

type BenefitBundle = {
  benefit?: BenefitInfo | null;
  firstPaymentBenefit?: BenefitInfo | null;
};
 
type OfferProgram = {
  offeringId: string;
  programId: string;
  programName: string;
  modality: string;
  schedule: string | null;
  planLink: string | null;
};
 
type PublicCta = {
  id: string;
  label: string;
  kind: "link" | "action";
  url: string | null;
  variant: string | null;
  placement?: string | null;
};

type Calculation = CalculationOk | CalculationErr;

type PaymentPlanRow = {
  label: string;
  detail: string;
  amount: number;
};

type PaymentPlanSection = {
  title: string;
  rows: PaymentPlanRow[];
};

type QuoteApiResult =
  | {
      ok: true;
      basePriceMxn: number;
      scholarshipPercent: number;
      scholarshipAmountMxn: number;
      additionalBenefitPercent: number;
      additionalBenefitNotes: string | null;
      additionalBenefitDuration: string | null;
      additionalBenefitAmountMxn: number;
      firstPaymentAmountMxn: number;
      firstPaymentNotes: string | null;
      firstPaymentDuration: string | null;
      subtotalMxn: number;
      totalMxn: number;
      tier: string | null;
      sinAccessToScholarship: boolean;
      source: string;
    }
  | {
      ok: false;
      error: string;
      hint?: string;
      missing?: string[];
      ranges?: string[];
      source: string;
    };

const currency = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 2,
});
 
const round2 = (value: number) => Math.round(value * 100) / 100;
 
const formatMoney = (value: number) => currency.format(round2(value));

const enrollmentTypeLabels: Record<TipoInscripcion, string> = {
  nuevo_ingreso: "Nuevo ingreso",
  regreso: "Regreso",
  reingreso: "Reingreso",
};

const businessLineLabels: Record<string, string> = {
  licenciatura: "Licenciatura",
  salud: "Salud",
  preparatoria: "Preparatoria",
  prepa: "Preparatoria",
  posgrado: "Posgrado",
  maestria: "Maestria",
  doctorado: "Doctorado",
};

const modalityLabels: Record<string, string> = {
  presencial: "Presencial",
  mixta: "Mixta",
  online: "Online",
  ejecutivo: "Ejecutivo",
};

const compactText = (value: string | null | undefined) =>
  value?.replace(/\s+/g, " ").trim() ?? "";

const humanizeLabel = (value: string) => {
  if (!value) return value;
  return (
    businessLineLabels[value] ??
    modalityLabels[value] ??
    value.charAt(0).toUpperCase() + value.slice(1)
  );
};

const formatPercent = (value: number) =>
  `${Number.isInteger(value) ? value : round2(value)}%`;

const toUiBusinessLine = (value: SimulatorInputSnapshot["businessLine"]) =>
  value === "prepa" ? "preparatoria" : value;

const toUiModality = (value: SimulatorInputSnapshot["modality"]) => value;

const toQuoteApiResult = (result: SimulatorResultSnapshot): QuoteApiResult => ({
  ok: true,
  basePriceMxn: result.basePriceMxn,
  scholarshipPercent: result.scholarshipPercent,
  scholarshipAmountMxn: result.scholarshipAmountMxn,
  additionalBenefitPercent: result.additionalBenefitPercent,
  additionalBenefitNotes: result.additionalBenefitNotes,
  additionalBenefitDuration: result.additionalBenefitDuration,
  additionalBenefitAmountMxn: result.additionalBenefitAmountMxn,
  firstPaymentAmountMxn: result.firstPaymentAmountMxn,
  firstPaymentNotes: result.firstPaymentNotes,
  firstPaymentDuration: result.firstPaymentDuration,
  subtotalMxn: result.subtotalMxn,
  totalMxn: result.totalMxn,
  tier: result.tier,
  source: result.source,
  sinAccessToScholarship: result.sinAccessToScholarship,
});
 
const uniqSorted = (items: string[]) =>
  Array.from(new Set(items.filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, "es")
  );
 
const toNum = (value: unknown) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const trimmed = value.trim().replace(",", ".");
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

const normalizeLookupKey = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
 
const requierePlantel = (nivel: string, modalidad: string) => {
  if (!nivel || !modalidad) return false;
  return (
    (nivel === "licenciatura" ||
      nivel === "salud" ||
      nivel === "preparatoria") &&
    modalidad !== "online"
  );
};
 
const resolvePlantelKey = (
  nivel: string,
  modalidad: string,
  plantelValue: string
) => {
  if (!nivel || !modalidad) return "";
  if (modalidad === "online") return "ONLINE";
  if (requierePlantel(nivel, modalidad)) return plantelValue || "";
  return "";
};
 
const toBenefitBusinessLine = (nivel: string) => {
  if (!nivel) return "";
  if (nivel === "salud") return "salud";
  if (nivel === "licenciatura") return "licenciatura";
  if (nivel === "preparatoria" || nivel === "prepa") return "prepa";
  if (nivel === "posgrado" || nivel === "maestria" || nivel === "doctorado")
    return "posgrado";
  return "";
};
 
const toBenefitModality = (modalidad: string) => {
  if (!modalidad) return "";
  if (modalidad === "online") return "online";
  if (modalidad === "presencial") return "presencial";
  if (modalidad === "ejecutivo" || modalidad === "mixta") return "mixta";
  return "";
};
 
const shouldShowMaterias = (tipo: TipoInscripcion, nivel: string) =>
  tipo === "regreso" && nivel === "licenciatura";
 
const getTierForPlantel = (meta: MetaResponse | null, plantelKey: string) => {
  if (!plantelKey) return null;
  return meta?.planteles?.[plantelKey]?.tier ?? null;
};
 
const getOfertaNeto = (
  meta: MetaResponse | null,
  plantelKey: string,
  nivel: string,
  plan: number
) => {
  if (!plantelKey || !nivel || !plan) return null;
  const oferta = meta?.planteles?.[plantelKey]?.oferta?.[nivel]?.[String(plan)];
  const neto = oferta?.neto;
  return typeof neto === "number" ? neto : null;
};
 
const getMateriasPrecio = (
  regreso: RegresoResponse | null,
  nivel: string,
  modalidad: string,
  plantelKey: string,
  materiasCount: number
) => {
  if (!nivel || !modalidad || !plantelKey || !materiasCount) return null;
  if (nivel !== "licenciatura") return null;
  const modalidadKey = modalidad === "online" ? "online" : "presencial";
  const plantelEntries = regreso?.materias ?? {};
  const normalizedPlantelKey = normalizeLookupKey(plantelKey);
  const plantelBucket =
    plantelEntries[plantelKey] ??
    Object.entries(plantelEntries).find(
      ([key]) => normalizeLookupKey(key) === normalizedPlantelKey
    )?.[1];
  if (!plantelBucket) return null;

  const modalidadBucket =
    plantelBucket[modalidadKey] ??
    Object.entries(plantelBucket).find(
      ([key]) => normalizeLookupKey(key) === normalizeLookupKey(modalidadKey)
    )?.[1];
  if (!modalidadBucket) return null;

  const value = modalidadBucket[String(materiasCount)];
  return typeof value === "number" ? value : null;
};
 
const findRuleForPromedio = (
  rules: FlatRule[],
  promedio: number
): FlatRule | null => {
  for (const rule of rules) {
    const rango = rule.rango;
    if (!rango) continue;
    const minRaw = toNum((rango as { min?: unknown }).min);
    const maxRaw = toNum((rango as { max?: unknown }).max);
    if (minRaw === null || maxRaw === null) continue;
    const min = minRaw - 1e-6;
    const max = maxRaw + 1e-6;
    if (promedio >= min && promedio <= max) return rule;
  }
  return null;
};
 
const formatRango = (rule: FlatRule) => {
  const rango = rule.rango;
  if (!rango) return null;
  const min = toNum((rango as { min?: unknown }).min);
  const max = toNum((rango as { max?: unknown }).max);
  if (min === null || max === null) return null;
  return `${min.toFixed(1)}-${max.toFixed(1)}`;
};
 
const listValidRanges = (rules: FlatRule[]) => {
  const ranges = rules.map(formatRango).filter((r): r is string => Boolean(r));
  return Array.from(new Set(ranges));
};
 
const findNearestRule = (rules: FlatRule[], promedio: number) => {
  let best: { rule: FlatRule; distance: number } | null = null;
  for (const rule of rules) {
    const rango = rule.rango;
    if (!rango) continue;
    const min = toNum((rango as { min?: unknown }).min);
    const max = toNum((rango as { max?: unknown }).max);
    if (min === null || max === null) continue;
    const distance =
      promedio < min ? min - promedio : promedio > max ? promedio - max : 0;
    if (!best || distance < best.distance) best = { rule, distance };
  }
  return best?.rule ?? null;
};
 
const baseFromRules = (rules: FlatRule[]) => {
  const ref = rules[0];
  if (!ref) return null;
  const monto = toNum(ref.monto);
  const pct = toNum(ref.porcentaje);
  if (monto === null || pct === null || pct >= 100) return null;
  return monto / (1 - pct / 100);
};
 
const baseFromRule = (rule: FlatRule | null) => {
  if (!rule) return null;
  const monto = toNum(rule.monto);
  const pct = toNum(rule.porcentaje);
  if (monto === null || pct === null || pct >= 100) return null;
  return monto / (1 - pct / 100);
};
 
export default function ScholarshipCalculator({
  ctasAboveResult = [],
  ctasInsideResult = [],
  ctasBelowResult = [],
  resultBelowAnnouncements = [],
  resultAboveAnnouncements = [],
  resultInsideAnnouncements = [],
  calculatorFooterAnnouncements = [],
  ctasCalculatorFooter = [],
  whatsappTemplates,
  belowResultSlot = null,
  hideActionRail = false,
  quoteMode = "legacy",
  visibleOfferCycles = ["C1"],
}: {
  ctasAboveResult?: PublicCta[];
  ctasInsideResult?: PublicCta[];
  ctasBelowResult?: PublicCta[];
  resultBelowAnnouncements?: Announcement[];
  resultAboveAnnouncements?: Announcement[];
  resultInsideAnnouncements?: Announcement[];
  calculatorFooterAnnouncements?: Announcement[];
  ctasCalculatorFooter?: PublicCta[];
  whatsappTemplates: WhatsappTemplateCollection;
  belowResultSlot?: React.ReactNode;
  hideActionRail?: boolean;
  quoteMode?: "legacy" | "compare" | "canonical";
  visibleOfferCycles?: AcademicOfferCycle[];
}) {
  const { userEmail, isAdmin, adminUnlocked } = useAppContext();
  void ctasInsideResult;
  void ctasBelowResult;
  void resultBelowAnnouncements;
  void calculatorFooterAnnouncements;
  void ctasCalculatorFooter;
  const useCanonicalQuote = quoteMode === "canonical";
  const normalizedVisibleOfferCycles = useMemo(
    () => Array.from(new Set(visibleOfferCycles.filter(Boolean))),
    [visibleOfferCycles],
  );

  const [tipo, setTipo] = useState<TipoInscripcion>("nuevo_ingreso");
  const [selectedOfferCycle, setSelectedOfferCycle] = useState<AcademicOfferCycle | "">(
    normalizedVisibleOfferCycles[0] ?? "",
  );
 
  const [rules, setRules] = useState<FlatRule[] | null>(null);
  const [meta, setMeta] = useState<MetaResponse | null>(null);
  const [regreso, setRegreso] = useState<RegresoResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
 
  const [nivel, setNivel] = useState("");
  const [modalidad, setModalidad] = useState("");
  const [plan, setPlan] = useState<number | null>(null);
  const [plantel, setPlantel] = useState("");
  const [materias, setMaterias] = useState<number | null>(null);
  const [promedio, setPromedio] = useState("");
 
  const [offerPrograms, setOfferPrograms] = useState<OfferProgram[]>([]);
  const [offerProgramId, setOfferProgramId] = useState("");
  const [offerSelectedProgramId, setOfferSelectedProgramId] = useState("");
  const [offerProgramsLoading, setOfferProgramsLoading] = useState(false);
  const [offerProgramsError, setOfferProgramsError] = useState<string | null>(null);
  const [cargoEnabled, setCargoEnabled] = useState(false);
  const [cargoType, setCargoType] = useState("");
  const [cargoAmount, setCargoAmount] = useState("");
  const [academicFees, setAcademicFees] = useState<
    Array<{ id: string; code: string; concept: string; costMxn: number; section: string }>
  >([]);
  const [academicFeesLoading, setAcademicFeesLoading] = useState(false);
 
  // moduloIngreso removed from UI
 
  const [benefitBundle, setBenefitBundle] = useState<BenefitBundle | null>(null);
  const [beneficioLoading, setBeneficioLoading] = useState(false);
  const [beneficioError, setBeneficioError] = useState<string | null>(null);
  const [quoteResult, setQuoteResult] = useState<QuoteApiResult | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const {
    loadedScenarioFingerprint,
    loadedScenarioResult,
    registerApplyScenarioHandler,
    setCurrentSnapshot,
    trackEvent,
  } = useSimulator();
  const applyingScenarioRef = useRef(false);
  const [copyQuoteImagePending, setCopyQuoteImagePending] = useState(false);
  const [copyQuoteImageStatus, setCopyQuoteImageStatus] = useState<string | null>(null);
  const [showPaymentPlan, setShowPaymentPlan] = useState(false);
 
  const tipoLabelId = useId();
  const nivelLabelId = useId();
  const modalidadLabelId = useId();
  const planLabelId = useId();
  const plantelLabelId = useId();
  // moduloLabelId removed
  const materiasLabelId = useId();
  const promedioLabelId = useId();
  const ofertaLabelId = useId();
  const cargoTypeLabelId = useId();
  const cargoAmountLabelId = useId();

  useEffect(() => {
    registerApplyScenarioHandler((_session, scenario) => {
      applyingScenarioRef.current = true;
      setTipo(scenario.input.enrollmentType);
      setNivel(toUiBusinessLine(scenario.input.businessLine));
      setModalidad(toUiModality(scenario.input.modality));
      setPlan(scenario.input.plan);
      setPlantel(scenario.input.campus ?? "");
      setMaterias(scenario.input.subjectCount ?? null);
      setPromedio(String(scenario.input.average));
      setCargoEnabled((scenario.input.extraChargeAmount ?? 0) > 0);
      setCargoType(scenario.input.chargeType ?? "");
      setCargoAmount(
        scenario.input.extraChargeAmount
          ? String(scenario.input.extraChargeAmount)
          : "",
      );
      setOfferProgramId(scenario.input.selectedProgramId ?? "");
      setOfferSelectedProgramId(scenario.input.selectedProgramId ?? "");
      setQuoteResult(toQuoteApiResult(scenario.result));
      window.setTimeout(() => {
        applyingScenarioRef.current = false;
      }, 0);
    });

    return () => registerApplyScenarioHandler(null);
  }, [registerApplyScenarioHandler]);

  const refreshData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [flatRulesRes, metaRes, regresoRes] = await Promise.all([
        fetch("/api/data/flat-rules", { cache: "no-store" }),
        fetch("/api/data/meta", { cache: "no-store" }),
        fetch("/api/data/regreso-materias", { cache: "no-store" }),
      ]);
 
      if (!flatRulesRes.ok) throw new Error("No fue posible cargar reglas.");
      if (!metaRes.ok) throw new Error("No fue posible cargar meta.");
      if (!regresoRes.ok)
        throw new Error("No fue posible cargar regreso-materias.");
 
      const [flatRules, metaJson, regresoJson] = await Promise.all([
        flatRulesRes.json(),
        metaRes.json(),
        regresoRes.json(),
      ]);
 
      setRules(flatRules as FlatRule[]);
      setMeta(metaJson as MetaResponse);
      setRegreso(regresoJson as RegresoResponse);
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : "No fue posible cargar datos."
      );
    } finally {
      setLoading(false);
    }
  }, []);
 
  useEffect(() => {
    void refreshData();
  }, [refreshData]);

  useEffect(() => {
    const onRefresh = () => {
      void refreshData();
    };
    window.addEventListener("recalc:refresh-data", onRefresh);
    return () => window.removeEventListener("recalc:refresh-data", onRefresh);
  }, [refreshData]);

  useEffect(() => {
    setSelectedOfferCycle((current) => {
      if (current && normalizedVisibleOfferCycles.includes(current)) return current;
      return normalizedVisibleOfferCycles[0] ?? "";
    });
  }, [normalizedVisibleOfferCycles]);

 
  const programaKey = tipo === "nuevo_ingreso" ? "nuevo_ingreso" : "reingreso";
 
  const niveles = useMemo(() => {
    if (!rules) return [];
    const filtered = rules.filter((r) => r.programa === programaKey);
    return uniqSorted(filtered.map((r) => r.nivel));
  }, [rules, programaKey]);
 
  const modalidades = useMemo(() => {
    if (!rules || !nivel) return [];
    const filtered = rules.filter(
      (r) => r.programa === programaKey && r.nivel === nivel
    );
    const all = uniqSorted(filtered.map((r) => r.modalidad));
    if (nivel === "salud") return all.filter((m) => m === "presencial");
    const order: Record<string, number> = { presencial: 0, mixta: 1, online: 2 };
    return all.sort((a, b) => (order[a] ?? 9) - (order[b] ?? 9));
  }, [rules, nivel, programaKey]);
 
  const planes = useMemo(() => {
    if (!rules || !nivel || !modalidad) return [];
    const filtered = rules.filter(
      (r) =>
        r.programa === programaKey &&
        r.nivel === nivel &&
        r.modalidad === modalidad
    );
    return Array.from(new Set(filtered.map((r) => Number(r.plan)))).sort((a, b) => a - b);
  }, [rules, nivel, modalidad, programaKey]);
 
  const planteles = useMemo(() => {
    const plantelesObj = meta?.planteles ?? {};
    const keys = Object.keys(plantelesObj);
    return keys
      .filter((key) => key && key !== "ONLINE")
      .sort((a, b) => a.localeCompare(b, "es"));
  }, [meta]);
 
  const materiasOptions = useMemo(() => [1, 2, 3, 4, 5, 6, 7], []);
 
  useEffect(() => {
    if (applyingScenarioRef.current) return;
    setNivel("");
    setModalidad("");
    setPlan(null);
    setPlantel("");
    setMaterias(null);
    setPromedio("");
  }, [tipo]);
 
  useEffect(() => {
    if (applyingScenarioRef.current) return;
    setModalidad("");
    setPlan(null);
    setPlantel("");
    setMaterias(null);
  }, [nivel]);
 
  useEffect(() => {
    if (applyingScenarioRef.current) return;
    setPlan(null);
    setPlantel("");
    setMaterias(null);
  }, [modalidad]);
 
  useEffect(() => {
    if (applyingScenarioRef.current) return;
    setPlantel("");
    setMaterias(null);
  }, [plan]);
 
  useEffect(() => {
    if (!cargoEnabled) {
      setCargoType("");
      setCargoAmount("");
    }
  }, [cargoEnabled]);

  // T6: Auto-fill cargo amount when cargo type changes
  useEffect(() => {
    if (!cargoType) {
      setCargoAmount("");
      return;
    }
    const match = academicFees.find((fee) => fee.code === cargoType);
    setCargoAmount(match ? String(match.costMxn) : "");
  }, [cargoType, academicFees]);

  const benefitLookupKey = useMemo(() => {
    if (!modalidad) return "";
    if (modalidad === "online") return "ONLINE";
    if (requierePlantel(nivel, modalidad)) return plantel || "";
    return plantel || "";
  }, [nivel, modalidad, plantel]);

  // Fetch academic fees (costos académicos) when plantel changes
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const run = async () => {
      if (!benefitLookupKey) {
        setAcademicFees([]);
        return;
      }
      setAcademicFeesLoading(true);
      try {
        const res = await fetch(`/api/public/costos?campus=${encodeURIComponent(benefitLookupKey)}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!res.ok) throw new Error("fees_fetch_failed");
        const data = (await res.json()) as {
          fees?: Array<{ id: string; code: string; concept: string; costMxn: number; section: string }>;
        };
        if (!active) return;
        setAcademicFees(data.fees ?? []);
      } catch (err) {
        if (!active) return;
        if ((err as Error).name === "AbortError") return;
        setAcademicFees([]);
      } finally {
        if (active) setAcademicFeesLoading(false);
      }
    };
    run();
    return () => {
      active = false;
      controller.abort();
    };
  }, [benefitLookupKey]);

  const benefitBusinessLine = useMemo(
    () => toBenefitBusinessLine(nivel),
    [nivel]
  );
  const benefitModality = useMemo(
    () => toBenefitModality(modalidad),
    [modalidad]
  );
  const canLoadOfferPanel = useMemo(() => {
    if (!nivel || !modalidad || !plan) return false;
    if (modalidad === "online") return true;
    return !requierePlantel(nivel, modalidad) || Boolean(plantel);
  }, [nivel, modalidad, plan, plantel]);

  useEffect(() => {
    if (!useCanonicalQuote) {
      setQuoteResult(null);
      setQuoteLoading(false);
      return;
    }

    const hasStarted =
      Boolean(nivel) ||
      Boolean(modalidad) ||
      Boolean(plan) ||
      Boolean(plantel) ||
      Boolean(materias) ||
      Boolean(promedio.trim()) ||
      cargoEnabled ||
      Boolean(cargoType) ||
      Boolean(cargoAmount);

    if (!hasStarted) {
      setQuoteResult(null);
      setQuoteLoading(false);
      return;
    }

    let active = true;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      void run();
    }, QUOTE_DEBOUNCE_MS);
    const run = async () => {
      setQuoteLoading(true);
      try {
        const res = await fetch("/api/data/quote", {
          method: "POST",
          cache: "no-store",
          signal: controller.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            enrollmentType: tipo,
            businessLine: benefitBusinessLine,
            modality: benefitModality || modalidad,
            plan,
            campus: benefitLookupKey || plantel || null,
            average: promedio.trim(),
            subjectCount: materias,
            extraCharge: cargoEnabled ? cargoAmount : null,
          }),
        });

        const data = (await res.json()) as QuoteApiResult;
        if (!active) return;
        setQuoteResult(data);
      } catch (err) {
        if (!active || (err as Error).name === "AbortError") return;
        setQuoteResult({
          ok: false,
          error: "No fue posible consultar la cotización canónica.",
          source: "canonical",
        });
      } finally {
        if (active) setQuoteLoading(false);
      }
    };

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [
    useCanonicalQuote,
    tipo,
    benefitBusinessLine,
    benefitModality,
    benefitLookupKey,
    modalidad,
    plan,
    plantel,
    promedio,
    materias,
    cargoEnabled,
    cargoType,
    cargoAmount,
    nivel,
  ]);
 
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const run = async () => {
      setBeneficioLoading(true);
      setBeneficioError(null);
      try {
        const params = new URLSearchParams();
        if (benefitLookupKey) {
          params.set("plantel", benefitLookupKey);
        }
        if (benefitBusinessLine) {
          params.set("businessLine", benefitBusinessLine);
        }
        if (benefitModality) {
          params.set("modality", benefitModality);
        }
        params.set("enrollmentType", tipo);
        const endpoint = params.toString()
          ? `/api/data/benefits?${params.toString()}`
          : "/api/data/benefits";
        const res = await fetch(endpoint, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!res.ok) {
          throw new Error("benefit_fetch_failed");
        }
        const data = (await res.json()) as BenefitBundle;
        if (!active) return;
        setBenefitBundle({
          benefit: data.benefit ?? null,
          firstPaymentBenefit: data.firstPaymentBenefit ?? null,
        });
      } catch (err) {
        if (!active) return;
        if ((err as Error).name === "AbortError") return;
        setBeneficioError("No fue posible cargar beneficio.");
        setBenefitBundle(null);
      } finally {
        if (active) setBeneficioLoading(false);
      }
    };
    run();
    return () => {
      active = false;
      controller.abort();
    };
  }, [benefitLookupKey, benefitBusinessLine, benefitModality, tipo]);
 
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
 
    const run = async () => {
      if (!canLoadOfferPanel || !benefitLookupKey || !selectedOfferCycle) {
        setOfferPrograms([]);
        setOfferProgramsError(null);
        setOfferProgramsLoading(false);
        setOfferProgramId("");
        setOfferSelectedProgramId("");
        return;
      }
 
      setOfferProgramsLoading(true);
      setOfferProgramsError(null);
      try {
        const params = new URLSearchParams();
        params.set("campus", benefitLookupKey);
        params.set("cycle", selectedOfferCycle);
        if (benefitBusinessLine) params.set("line", benefitBusinessLine);
        const res = await fetch(`/api/public/oferta?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!res.ok) {
          throw new Error("offer_fetch_failed");
        }
 
        const data = (await res.json()) as {
          offerings?: Array<{
            id: string;
            modality: string;
            schedule?: string | null;
            planLink?: string | null;
            program: {
              id: string;
              name: string;
            };
          }>;
        };
        if (!active) return;
 
        const items = (data.offerings ?? []).map((row) => ({
          offeringId: row.id,
          programId: row.program.id,
          programName: row.program.name,
          modality: row.modality,
          schedule: row.schedule ?? null,
          planLink: row.planLink ?? null,
        }));
        setOfferPrograms(items);
        setOfferProgramId((current) => {
          if (!current) return "";
          return items.some((item) => item.offeringId === current) ? current : "";
        });
      } catch (err) {
        if (!active) return;
        if ((err as Error).name === "AbortError") return;
        setOfferPrograms([]);
        setOfferProgramId("");
        setOfferSelectedProgramId("");
        setOfferProgramsError("No fue posible cargar la oferta del plantel.");
      } finally {
        if (active) setOfferProgramsLoading(false);
      }
    };
 
    run();
    return () => {
      active = false;
      controller.abort();
    };
  }, [canLoadOfferPanel, benefitLookupKey, benefitBusinessLine, selectedOfferCycle]);
 
  useEffect(() => {
    const selected =
      offerPrograms.find((item) => item.offeringId === offerProgramId) ?? null;
    setOfferSelectedProgramId(selected?.programId ?? "");
  }, [offerProgramId, offerPrograms]);
 
  const legacyCalculation = useMemo<Calculation | null>(() => {
    if (!rules) return null;
 
    const hasStarted =
      Boolean(nivel) ||
      Boolean(modalidad) ||
      Boolean(plan) ||
      Boolean(plantel) ||
      Boolean(materias) ||
      Boolean(promedio.trim()) ||
      cargoEnabled ||
      Boolean(cargoType) ||
      Boolean(cargoAmount);
 
    if (!hasStarted) return null;
 
    const missing: CalculationErr["missing"] = [];
    if (!nivel) missing.push("nivel");
    if (!modalidad) missing.push("modalidad");
    if (!plan) missing.push("plan");
    if (missing.length) {
      const labelMap: Record<string, string> = {
        nivel: "Línea de negocio",
        modalidad: "Modalidad",
        plan: "Plan de estudios",
        cargoType: "Tipo de cargo académico",
        cargoAmount: "Monto de cargo académico",
      };
      return {
        error: "Faltan campos obligatorios.",
        hint: `Completa: ${missing
          .map((m) => labelMap[m] ?? m)
          .join(", ")}.`,
        missing,
      };
    }
    const planNum = plan as number;
 
    const reqPlantel = requierePlantel(nivel, modalidad);
    const plantelKey = resolvePlantelKey(nivel, modalidad, plantel);
    const needsPlantelKey = modalidad === "online" ? "ONLINE" : plantelKey;
 
    if (reqPlantel && !plantel) {
      return {
        error: "Falta seleccionar un plantel.",
        hint: "Selecciona un plantel para continuar con el cálculo.",
        missing: ["plantel"],
      };
    }
 
    const showMaterias = shouldShowMaterias(tipo, nivel);
    if (showMaterias && !materias) {
      return {
        error: "Falta seleccionar materias.",
        hint: "Selecciona cuántas materias se van a inscribir.",
        missing: ["materias"],
      };
    }
 
    const promedioStr = promedio.trim();
    if (!promedioStr) {
      return {
        error: "Falta el promedio.",
        hint: "Ingresa el promedio del estudiante (0 a 10).",
        missing: ["promedio"],
      };
    }
    const promedioNumRaw = Number(promedioStr.replace(",", "."));
    if (Number.isNaN(promedioNumRaw) || promedioNumRaw <= 0 || promedioNumRaw > 10) {
      return {
        error: "Promedio inválido.",
        hint: "Ingresa un promedio válido entre 0 y 10.",
        missing: ["promedio"],
      };
    }
 
    const promedioNum = Math.round(promedioNumRaw * 10) / 10;
 
    if (cargoEnabled) {
      const cargoMissing: CalculationErr["missing"] = [];
      if (!cargoType) cargoMissing.push("cargoType");
      const cargoNum = toNum(cargoAmount);
      if (cargoNum === null || cargoNum <= 0) cargoMissing.push("cargoAmount");
      if (cargoMissing.length) {
        return {
          error: "Falta completar el cargo académico.",
          hint: "Selecciona el tipo de cargo y define el monto.",
          missing: cargoMissing,
        };
      }
    }
 
    let candidatos = rules.filter(
      (r) =>
        r.programa === programaKey &&
        r.nivel === nivel &&
        r.modalidad === modalidad &&
        Number(r.plan) === planNum
    );
 
    if (!candidatos.length) {
      // Check if there are any rules for this nivel+modalidad (ignoring plan).
      // If so, the current plan value is stale (nivel/modalidad changed but plan
      // hasn't been cleared by its effect yet). Treat it as a missing plan.
      const hasRulesForCombo = rules.some(
        (r) =>
          r.programa === programaKey &&
          r.nivel === nivel &&
          r.modalidad === modalidad
      );
      if (hasRulesForCombo) {
        return {
          error: "Faltan campos obligatorios.",
          hint: "Selecciona un plan de estudios.",
          missing: ["plan"] as CalculationErr["missing"],
        };
      }
      return {
        error: "No hay reglas para esta combinación.",
        hint: "Intenta cambiar línea de negocio, modalidad o plan de estudios.",
      };
    }
 
    const tier =
      modalidad === "online"
        ? "ONLINE"
        : getTierForPlantel(meta, needsPlantelKey);
    if (tier) {
      const byTier = candidatos.filter((r) => r.tier === tier);
      if (byTier.length) candidatos = byTier;
    }
 
    const sinAccesoBeca = promedioNum < 7;
    let match = sinAccesoBeca ? null : findRuleForPromedio(candidatos, promedioNum);
 
    if (!sinAccesoBeca && !match) {
      const nearest = findNearestRule(candidatos, promedioNum);
      if (nearest) {
        const rango = nearest.rango as { min?: unknown; max?: unknown } | null;
        const min = rango ? toNum(rango.min) : null;
        const max = rango ? toNum(rango.max) : null;
        if (
          min !== null &&
          max !== null &&
          promedioNum >= min - 0.05 &&
          promedioNum <= max + 0.05
        ) {
          match = nearest;
        }
      }
    }
 
    if (!sinAccesoBeca && !match) {
      const ranges = listValidRanges(candidatos);
      return {
        error: "No se encontró costo para ese promedio en esta combinación.",
        hint: ranges.length
          ? "Revisa el promedio o elige otra combinación. Abajo se muestran rangos válidos."
          : "Revisa el promedio o elige otra combinación.",
        ranges,
      };
    }
 
    let porcentaje = toNum(match?.porcentaje) ?? 0;
    if (tipo !== "nuevo_ingreso") {
      porcentaje = Math.min(porcentaje, MAX_BECA_REGRESO);
    }
 
    const materiasPrecio = showMaterias
      ? getMateriasPrecio(regreso, nivel, modalidad, needsPlantelKey, materias ?? 0)
      : null;
 
    let base: number | null =
      typeof materiasPrecio === "number"
        ? materiasPrecio
        : getOfertaNeto(meta, needsPlantelKey, nivel, planNum);
 
    if (typeof base !== "number") {
      base = baseFromRule(match) ?? baseFromRules(candidatos);
    }
    if (typeof base !== "number") {
      return { error: "No fue posible determinar el costo base de esta combinación." };
    }
 
    const montoFinal = base * (1 - porcentaje / 100);
    return {
      base,
      porcentaje,
      montoFinal,
      sinAccesoBeca,
      tier: tier ?? null,
      plantelKey: needsPlantelKey,
    };
  }, [
    rules,
    nivel,
    modalidad,
    plan,
    plantel,
    materias,
    promedio,
    tipo,
    cargoEnabled,
    cargoType,
    cargoAmount,
    meta,
    regreso,
    programaKey,
  ]);
 
  const quoteCalculation = useMemo<Calculation | null>(() => {
    if (!quoteResult) return null;
    if (!quoteResult.ok) {
      return normalizeQuoteError(quoteResult);
    }

    return {
      base: quoteResult.basePriceMxn,
      porcentaje: quoteResult.scholarshipPercent,
      montoFinal: quoteResult.totalMxn,
      sinAccesoBeca: quoteResult.sinAccessToScholarship,
      tier: quoteResult.tier,
      plantelKey: benefitLookupKey,
      subtotalMxn: quoteResult.subtotalMxn,
      totalMxn: quoteResult.totalMxn,
      scholarshipAmountMxn: quoteResult.scholarshipAmountMxn,
      additionalBenefitPercent: quoteResult.additionalBenefitPercent,
      additionalBenefitNotes: quoteResult.additionalBenefitNotes,
      additionalBenefitDuration: quoteResult.additionalBenefitDuration,
      additionalBenefitAmountMxn: quoteResult.additionalBenefitAmountMxn,
      firstPaymentAmountMxn: quoteResult.firstPaymentAmountMxn,
      firstPaymentNotes: quoteResult.firstPaymentNotes,
      firstPaymentDuration: quoteResult.firstPaymentDuration,
    };
  }, [quoteResult, benefitLookupKey]);

  const calculation =
    useCanonicalQuote && quoteCalculation ? quoteCalculation : legacyCalculation;

  const calcErr = calculation && "error" in calculation ? calculation : null;
  const calcError = calcErr?.error ?? null;
  const calcOk = calculation && !("error" in calculation) ? calculation : null;
 
  const inputClass = (hasError: boolean) =>
    ["ui-control", hasError ? "ui-control--error" : ""].filter(Boolean).join(" ");
 
  const tipoOptions = [
    { value: "nuevo_ingreso", label: "Nuevo ingreso" },
    { value: "regreso", label: "Regreso" },
    { value: "reingreso", label: "Reingreso" },
  ];
  const nivelOptions = niveles.map((n) => ({ value: n, label: n }));
  const modalidadOptions = modalidades.map((m) => ({ value: m, label: m }));
  const planOptions = planes.map((p) => ({ value: String(p), label: String(p) }));
  const plantelOptions = planteles.map((p) => ({ value: p, label: p }));
  const materiasOptionsUi = materiasOptions.map((m) => ({
    value: String(m),
    label: String(m),
  }));
  const offerProgramOptions = offerPrograms.map((item) => ({
    value: item.offeringId,
    label: item.programName,
    keywords: `${item.modality} ${item.schedule ?? ""}`,
  }));
  const cargoOptions = academicFees.length
    ? academicFees.map((fee) => ({
        value: fee.code,
        label: fee.concept,
        cost: fee.costMxn,
      }))
    : [
        { value: "inscripcion", label: "Inscripción", cost: 0 },
        { value: "reinscripcion", label: "Reinscripción", cost: 0 },
        { value: "credencial", label: "Credencial", cost: 0 },
        { value: "kardex", label: "Kardex", cost: 0 },
        { value: "revalidacion", label: "Revalidación", cost: 0 },
      ];
  const selectedOfferProgram =
    offerPrograms.find((item) => item.offeringId === offerProgramId) ?? null;

  const porcentajeBenefit = benefitBundle?.benefit ?? null;
  const firstPaymentBenefit = benefitBundle?.firstPaymentBenefit ?? null;
  const beneficioPercent =
    calcOk?.additionalBenefitPercent ?? porcentajeBenefit?.extraPercent ?? 0;
  const beneficioNotes =
    calcOk?.additionalBenefitNotes ?? porcentajeBenefit?.notes ?? "";
  const beneficioDuration =
    calcOk?.additionalBenefitDuration ?? porcentajeBenefit?.duration ?? null;
  const beneficioDurationSentence = formatBenefitDurationSentence(beneficioDuration);
  const firstPaymentAmount =
    calcOk?.firstPaymentAmountMxn ?? firstPaymentBenefit?.firstPaymentAmount ?? 0;
  const firstPaymentNotes =
    calcOk?.firstPaymentNotes ?? firstPaymentBenefit?.notes ?? "";
  const firstPaymentDuration =
    calcOk?.firstPaymentDuration ?? firstPaymentBenefit?.duration ?? null;
  // Los beneficios porcentuales nunca aplican para Regresos; Primer pago sí puede aplicar.
  const beneficioBlockedByTipo = tipo === "regreso";
  const beneficioAplica = !beneficioBlockedByTipo && beneficioPercent > 0;
  const firstPaymentAplica = firstPaymentAmount > 0;
  const effectiveBenefitLoading = useCanonicalQuote ? quoteLoading : beneficioLoading;
  const effectiveBenefitError = useCanonicalQuote ? null : beneficioError;
  const selectedCargo = cargoOptions.find((o) => o.value === cargoType);
  const cargoLabel = selectedCargo?.label ?? "Cargo académico";
  const cargoAmountValue = cargoEnabled ? toNum(cargoAmount) ?? 0 : 0;
  const becaPct = calcOk ? (calcOk.sinAccesoBeca ? 0 : calcOk.porcentaje) : 0;
  const becaMonto =
    calcOk?.scholarshipAmountMxn ?? (calcOk ? calcOk.base * (becaPct / 100) : 0);
  const afterBeca = calcOk ? calcOk.base - becaMonto : 0;
  const beneficioMonto =
    calcOk?.additionalBenefitAmountMxn ??
    (calcOk && beneficioAplica ? calcOk.base * (beneficioPercent / 100) : 0);
  const subtotal = calcOk?.subtotalMxn ?? (calcOk ? afterBeca - beneficioMonto : 0);
  const total =
    calcOk?.totalMxn ??
    (calcOk ? subtotal + (cargoEnabled ? cargoAmountValue : 0) : 0);
  const currentSimulatorInput = useMemo<SimulatorInputSnapshot | null>(() => {
    if (!calcOk || !plan || !benefitBusinessLine || !benefitModality) return null;
    return {
      enrollmentType: tipo,
      businessLine: benefitBusinessLine,
      modality: benefitModality,
      plan,
      campus: plantel || null,
      average: toNum(promedio) ?? 0,
      subjectCount: materias,
      extraChargeAmount: cargoEnabled ? cargoAmountValue : 0,
      chargeType: cargoEnabled ? cargoType || null : null,
      selectedProgramId: offerSelectedProgramId || null,
      selectedProgramName: selectedOfferProgram?.programName ?? null,
    };
  }, [
    benefitBusinessLine,
    benefitModality,
    calcOk,
    cargoAmountValue,
    cargoEnabled,
    cargoType,
    materias,
    offerSelectedProgramId,
    plan,
    plantel,
    promedio,
    selectedOfferProgram?.programName,
    tipo,
  ]);
  const currentSimulatorResult = useMemo<SimulatorResultSnapshot | null>(() => {
    if (!calcOk) return null;
    return {
      source: useCanonicalQuote ? "canonical" : "legacy",
      basePriceMxn: calcOk.base,
      scholarshipPercent: becaPct,
      scholarshipAmountMxn: becaMonto,
      additionalBenefitPercent: beneficioAplica ? beneficioPercent : 0,
      additionalBenefitAmountMxn: beneficioAplica ? beneficioMonto : 0,
      additionalBenefitNotes: beneficioAplica ? beneficioNotes : "",
      additionalBenefitDuration: beneficioAplica ? beneficioDuration : null,
      firstPaymentAmountMxn: firstPaymentAplica ? firstPaymentAmount : 0,
      firstPaymentNotes: firstPaymentAplica ? firstPaymentNotes : "",
      firstPaymentDuration: firstPaymentAplica ? firstPaymentDuration : null,
      subtotalMxn: subtotal,
      totalMxn: total,
      tier: calcOk.tier,
      sinAccessToScholarship: calcOk.sinAccesoBeca,
    };
  }, [
    becaMonto,
    becaPct,
    beneficioAplica,
    beneficioMonto,
    beneficioNotes,
    beneficioDuration,
    beneficioPercent,
    calcOk,
    firstPaymentAmount,
    firstPaymentAplica,
    firstPaymentNotes,
    firstPaymentDuration,
    subtotal,
    total,
    useCanonicalQuote,
  ]);
  const currentSimulatorFingerprint = useMemo(
    () =>
      currentSimulatorInput ? buildSimulatorFingerprint(currentSimulatorInput) : null,
    [currentSimulatorInput],
  );
  const hasStaleLoadedScenario = Boolean(
    loadedScenarioFingerprint &&
      currentSimulatorFingerprint &&
      currentSimulatorFingerprint !== loadedScenarioFingerprint,
  );
  const activeScenarioResult = hasStaleLoadedScenario ? null : loadedScenarioResult;
  const resultPanelSnapshot = currentSimulatorResult ?? activeScenarioResult;
  const resultPanelBase = currentSimulatorResult
    ? calcOk?.base ?? 0
    : activeScenarioResult?.basePriceMxn ?? 0;
  const resultPanelScholarshipPercent = currentSimulatorResult
    ? becaPct
    : activeScenarioResult?.scholarshipPercent ?? 0;
  const resultPanelScholarshipAmount = currentSimulatorResult
    ? becaMonto
    : activeScenarioResult?.scholarshipAmountMxn ?? 0;
  const resultPanelSinScholarship = currentSimulatorResult
    ? calcOk?.sinAccesoBeca ?? false
    : activeScenarioResult?.sinAccessToScholarship ?? false;
  const resultPanelBenefitPercent = currentSimulatorResult
    ? beneficioAplica
      ? beneficioPercent
      : 0
    : activeScenarioResult?.additionalBenefitPercent ?? 0;
  const resultPanelBenefitAmount = currentSimulatorResult
    ? beneficioAplica
      ? beneficioMonto
      : 0
    : activeScenarioResult?.additionalBenefitAmountMxn ?? 0;
  const resultPanelBenefitDuration = currentSimulatorResult
    ? beneficioAplica
      ? beneficioDuration
      : null
    : activeScenarioResult?.additionalBenefitDuration ?? null;
  const resultPanelBenefitDurationLabel = formatBenefitDurationLabel(
    resultPanelBenefitDuration,
  );
  const resultPanelBenefitDurationSentence = formatBenefitDurationSentence(
    resultPanelBenefitDuration,
  );
  const resultPanelFirstPaymentAmount = currentSimulatorResult
    ? firstPaymentAplica
      ? firstPaymentAmount
      : 0
    : activeScenarioResult?.firstPaymentAmountMxn ?? 0;
  const resultPanelFirstPaymentNotes = currentSimulatorResult
    ? firstPaymentAplica
      ? firstPaymentNotes
      : ""
    : activeScenarioResult?.firstPaymentNotes ?? "";
  const resultPanelFirstPaymentDuration = currentSimulatorResult
    ? firstPaymentAplica
      ? firstPaymentDuration
      : null
    : activeScenarioResult?.firstPaymentDuration ?? null;
  const resultPanelFirstPaymentDurationLabel = formatBenefitDurationLabel(
    resultPanelFirstPaymentDuration,
  );
  const rawFirstPaymentDurationSentence = formatBenefitDurationSentence(
    resultPanelFirstPaymentDuration,
  );
  const resultPanelFirstPaymentDurationSentence =
    resultPanelFirstPaymentDuration === "pago_inicial"
      ? ""
      : rawFirstPaymentDurationSentence;
  const resultPanelChargeAmount = cargoEnabled ? cargoAmountValue : 0;
  const resultPanelChargeLabel = cargoLabel;
  const resultPanelScholarshipSubtotal = round2(
    Math.max(resultPanelBase - resultPanelScholarshipAmount, 0),
  );
  const resultPanelBenefitsTotal = round2(
    resultPanelBenefitPercent > 0 ? resultPanelBenefitAmount : 0,
  );
  const resultPanelPreChargeTotal = round2(
    Math.max(resultPanelScholarshipSubtotal - resultPanelBenefitsTotal, 0),
  );
  const resultPanelFinalTotal = round2(resultPanelPreChargeTotal + resultPanelChargeAmount);
  const showResultPanelBenefits = resultPanelBenefitsTotal > 0;
  const showResultPanelCharges = resultPanelChargeAmount > 0;
  const showResultPanelSecondaryTotal = showResultPanelBenefits && showResultPanelCharges;
  const resultPanelPrimaryTotal = showResultPanelCharges && !showResultPanelBenefits
    ? resultPanelFinalTotal
    : showResultPanelBenefits
      ? resultPanelPreChargeTotal
      : resultPanelScholarshipSubtotal;
  const resultPanelHeroCopy = resultPanelSinScholarship
    ? "Sin acceso a beca con el promedio capturado."
    : showResultPanelBenefits
      ? `Incluye beca de ${formatPercent(resultPanelScholarshipPercent)}. También aplica beneficio adicional de ${formatPercent(resultPanelBenefitPercent)}.`
      : `Incluye beca de ${formatPercent(resultPanelScholarshipPercent)}.`;
  const paymentPlanSections = useMemo<PaymentPlanSection[]>(() => {
    if (!resultPanelSnapshot) return [];

    const currentMonthlyAmount = resultPanelFinalTotal;
    const secondTermMonthlyAmount =
      showResultPanelBenefits && resultPanelBenefitDuration === "toda_la_carrera"
        ? resultPanelFinalTotal
        : resultPanelScholarshipSubtotal;
    const firstPaymentAmount =
      resultPanelFirstPaymentAmount > 0 ? resultPanelFirstPaymentAmount : 0;

    return [
      {
        title: "1er cuatrimestre",
        rows: [
          {
            label: "Pago de incorporación a la SEP",
            detail: "Primer pago",
            amount: firstPaymentAmount,
          },
          {
            label: "Primer Colegiatura",
            detail: "Costo mensual con beneficio aplicado",
            amount: 0,
          },
          ...[2, 3, 4].map((index) => ({
            label:
              index === 2
                ? "Segunda colegiatura"
                : index === 3
                  ? "Tercer colegiatura"
                  : "Cuarta colegiatura",
            detail: "Costo mensual con beneficio aplicado",
            amount: currentMonthlyAmount,
          })),
        ],
      },
      {
        title: "2do cuatrimestre",
        rows: [
          {
            label: "Pago de incorporación a la SEP",
            detail: "Primer pago",
            amount: firstPaymentAmount,
          },
          ...[1, 2, 3, 4].map((index) => ({
            label: `Mensualidad ${index}`,
            detail: "Costo mensual",
            amount: secondTermMonthlyAmount,
          })),
        ],
      },
    ];
  }, [
    resultPanelBenefitDuration,
    resultPanelFinalTotal,
    resultPanelFirstPaymentAmount,
    resultPanelScholarshipSubtotal,
    resultPanelSnapshot,
    showResultPanelBenefits,
  ]);
  const resultCampusLabel =
    modalidad === "online" ? "Online" : plantel || null;
  const resultProgramLabel = selectedOfferProgram?.programName ?? null;
  const resultScheduleLabel = selectedOfferProgram?.schedule ?? null;
  const whatsappNotes = [
    compactText(resultPanelBenefitDurationSentence),
    compactText(resultPanelFirstPaymentDurationSentence),
  ]
    .filter((value): value is string => Boolean(value))
    .join(" · ");
  const whatsappPreviewData = useMemo<WhatsappTemplatePreviewData>(() => ({
    campusLabel: resultCampusLabel ?? null,
    programLabel: resultProgramLabel ?? null,
    businessLineLabel: nivel ? humanizeLabel(nivel) : null,
    modalityLabel: modalidad ? humanizeLabel(modalidad) : null,
    planLabel: plan ? String(plan) : null,
    enrollmentTypeLabel: enrollmentTypeLabels[tipo],
    scheduleLabel: resultScheduleLabel ?? null,
    listPrice: resultPanelBase,
    scholarshipText: resultPanelSinScholarship
      ? "Sin acceso a beca"
      : `${formatPercent(resultPanelScholarshipPercent)} (-${formatMoney(resultPanelScholarshipAmount)})`,
    scholarshipPercentText: resultPanelSinScholarship
      ? "0%"
      : formatPercent(resultPanelScholarshipPercent),
    scholarshipAmountText: resultPanelSinScholarship
      ? formatMoney(0)
      : `-${formatMoney(resultPanelScholarshipAmount)}`,
    additionalBenefitText:
      resultPanelBenefitPercent > 0
        ? [
            `${formatPercent(resultPanelBenefitPercent)} (-${formatMoney(resultPanelBenefitAmount)})`,
            resultPanelBenefitDurationLabel,
          ]
            .filter((value): value is string => Boolean(value))
            .join(" · ")
        : "No aplica",
    additionalBenefitPercentText:
      resultPanelBenefitPercent > 0 ? formatPercent(resultPanelBenefitPercent) : "0%",
    additionalBenefitAmountText:
      resultPanelBenefitPercent > 0
        ? `-${formatMoney(resultPanelBenefitAmount)}`
        : formatMoney(0),
    firstPaymentText:
      resultPanelFirstPaymentAmount > 0
        ? [formatMoney(resultPanelFirstPaymentAmount), resultPanelFirstPaymentDurationLabel]
            .filter((value): value is string => Boolean(value))
            .join(" · ")
        : "No aplica",
    additionalChargeText:
      cargoEnabled && cargoAmountValue > 0
        ? `${cargoLabel} ${formatMoney(cargoAmountValue)}`
        : "Sin cargo",
    subtotal: resultPanelScholarshipSubtotal,
    total: resultPanelFinalTotal,
    notes: whatsappNotes || null,
    callToAction:
      "Si quieres, te ayudo a revisar inscripcion, documentos y siguiente paso.",
  }), [
    cargoAmountValue,
    cargoEnabled,
    cargoLabel,
    modalidad,
    nivel,
    plan,
    resultCampusLabel,
    resultPanelBase,
    resultPanelBenefitAmount,
    resultPanelBenefitDurationLabel,
    resultPanelBenefitPercent,
    resultPanelFirstPaymentAmount,
    resultPanelFirstPaymentDurationLabel,
    resultPanelScholarshipAmount,
    resultPanelScholarshipPercent,
    resultPanelSinScholarship,
    resultPanelScholarshipSubtotal,
    resultPanelFinalTotal,
    resultProgramLabel,
    resultScheduleLabel,
    tipo,
    whatsappNotes,
  ]);
  useEffect(() => {
    setCurrentSnapshot({
      input: currentSimulatorInput,
      result: currentSimulatorResult,
      fingerprint: currentSimulatorFingerprint,
      quoteMode,
    });
  }, [
    currentSimulatorFingerprint,
    currentSimulatorInput,
    currentSimulatorResult,
    quoteMode,
    setCurrentSnapshot,
  ]);

  useEffect(() => {
    return () => {
      setCurrentSnapshot({
        input: null,
        result: null,
        fingerprint: null,
        quoteMode: "legacy",
      });
    };
  }, [setCurrentSnapshot]);

  const trackConfiguredResultCta = (cta: PublicCta) =>
    void trackEvent("CTA_CLICKED", {
      metadata: {
        placement: cta.placement,
        kind: cta.kind,
        label: cta.label,
        url: cta.url,
      },
    });

  const handleCopyQuoteImage = useCallback(async () => {
    if (!resultPanelSnapshot) {
      setCopyQuoteImageStatus("No hay cotización actual para exportar.");
      return;
    }

    setCopyQuoteImagePending(true);
    setCopyQuoteImageStatus(null);

    try {
      const width = 408;
      const padding = 18;
      const contentWidth = width - padding * 2;
      const cardRadius = 8;
      const cardGap = 16;
      const scale = Math.min(window.devicePixelRatio || 2, 2);
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        throw new Error("No fue posible preparar la imagen.");
      }

      const fontFamily =
        "Inter, Geist, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
      const bodyFont = `14px ${fontFamily}`;
      const smallFont = `12px ${fontFamily}`;
      const rowFont = `14px ${fontFamily}`;
      const strongFont = `700 16px ${fontFamily}`;
      const cardInner = 16;
      const amountColumnWidth = 112;
      const labelColumnWidth = contentWidth - cardInner * 2 - amountColumnWidth - 12;
      const detailRows: Array<{
        label: string;
        value: string;
        muted?: string;
        strong?: boolean;
      }> = [
        { label: "Precio lista", value: formatMoney(resultPanelBase) },
        {
          label: `Beca ${
            resultPanelScholarshipPercent ? formatPercent(resultPanelScholarshipPercent) : ""
          }`,
          value: `-${formatMoney(resultPanelScholarshipAmount)}`,
          muted: resultPanelSinScholarship ? "Sin acceso a beca" : undefined,
        },
        { label: "Subtotal", value: formatMoney(resultPanelScholarshipSubtotal) },
      ];

      if (showResultPanelBenefits) {
        detailRows.push({
          label: "Beneficio adicional",
          value: `-${formatMoney(resultPanelBenefitsTotal)}`,
          muted: resultPanelBenefitDurationSentence ?? undefined,
        });
      }

      if (showResultPanelCharges) {
        detailRows.push({
          label: resultPanelChargeLabel,
          value: formatMoney(resultPanelChargeAmount),
          muted: "Cargo académico aplicado.",
        });
      }

      detailRows.push({
        label: "Total",
        value: formatMoney(resultPanelPrimaryTotal),
        strong: true,
      });

      if (showResultPanelSecondaryTotal) {
        detailRows.push({
          label: "Total ya con cargos aplicados",
          value: formatMoney(resultPanelFinalTotal),
          strong: true,
        });
      }

      const detailRowsForImage = detailRows.map((row) => {
        const activeRowFont = row.strong ? strongFont : rowFont;
        const labelLines = wrapCanvasText(ctx, row.label, labelColumnWidth, activeRowFont);
        const mutedLines = row.muted
          ? wrapCanvasText(ctx, row.muted, labelColumnWidth, smallFont)
          : [];
        const rowHeight = Math.max(
          row.strong ? 44 : 30,
          8 + labelLines.length * 20 + mutedLines.length * 16,
        );

        return { ...row, labelLines, mutedLines, rowHeight };
      });
      const detailRowsHeight = detailRowsForImage.reduce(
        (total, row) => total + row.rowHeight,
        0,
      );
      const firstPaymentNotesLines = resultPanelFirstPaymentNotes
        ? wrapCanvasText(
            ctx,
            resultPanelFirstPaymentNotes,
            contentWidth - cardInner * 2,
            bodyFont,
          )
        : [];
      const firstPaymentDurationLines = resultPanelFirstPaymentDurationSentence
        ? wrapCanvasText(
            ctx,
            resultPanelFirstPaymentDurationSentence,
            contentWidth - cardInner * 2,
            smallFont,
          )
        : [];
      const heroCopyLines = wrapCanvasText(
        ctx,
        resultPanelHeroCopy,
        contentWidth - cardInner * 2,
        bodyFont,
      );
      const heroAmount = formatMoney(resultPanelFinalTotal);
      const heroAmountFont = fitCanvasFontSize(
        ctx,
        heroAmount,
        contentWidth - cardInner * 2,
        fontFamily,
        { max: 42, min: 30, weight: 800 },
      );
      const heroHeight = Math.max(
        153,
        74 + heroAmountFont.size + heroCopyLines.length * 22,
      );
      const firstPaymentHeight =
        resultPanelFirstPaymentAmount > 0
          ? Math.max(
              122,
              76 +
                firstPaymentDurationLines.length * 16 +
                firstPaymentNotesLines.length * 20,
            )
          : 0;
      const breakdownHeight = 50 + detailRowsHeight;
      const height =
        padding +
        22 +
        18 +
        heroHeight +
        (firstPaymentHeight ? cardGap + firstPaymentHeight : 0) +
        cardGap +
        breakdownHeight +
        padding;

      canvas.width = width * scale;
      canvas.height = height * scale;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.scale(scale, scale);

      drawRoundedRect(ctx, 0.5, 0.5, width - 1, height - 1, 6, "#ffffff", "#c8d5df");
      ctx.fillStyle = "#55728b";
      ctx.font = `700 12px ${fontFamily}`;
      ctx.fillText("C O T I Z A C I Ó N", padding, padding + 12);

      let y = padding + 38;

      drawRoundedRect(ctx, padding, y, contentWidth, heroHeight, cardRadius, "#1c3f68");
      ctx.fillStyle = "#dbe7f0";
      ctx.font = `700 11px ${fontFamily}`;
      ctx.fillText("C O S T O   M E N S U A L", padding + cardInner, y + 28);
      ctx.fillStyle = "#ffffff";
      ctx.font = heroAmountFont.font;
      ctx.fillText(heroAmount, padding + cardInner, y + 78);
      ctx.fillStyle = "#edf6fb";
      ctx.font = bodyFont;
      heroCopyLines.forEach((line, index) => {
        ctx.fillText(line, padding + cardInner, y + 104 + index * 22);
      });

      y += heroHeight + cardGap;

      if (resultPanelFirstPaymentAmount > 0) {
        drawRoundedRect(
          ctx,
          padding,
          y,
          contentWidth,
          firstPaymentHeight,
          cardRadius,
          "#ffffff",
          "#cbd8e1",
        );
        ctx.fillStyle = "#668097";
        ctx.font = `700 11px ${fontFamily}`;
        ctx.fillText("P R I M E R   P A G O", padding + cardInner, y + 26);
        ctx.fillStyle = "#17385f";
        ctx.font = `700 18px ${fontFamily}`;
        ctx.fillText(
          formatMoney(resultPanelFirstPaymentAmount),
          padding + cardInner,
          y + 54,
        );
        let noteY = y + 78;
        ctx.font = smallFont;
        firstPaymentDurationLines.forEach((line) => {
          ctx.fillText(line, padding + cardInner, noteY);
          noteY += 16;
        });
        ctx.font = bodyFont;
        firstPaymentNotesLines.forEach((line, index) => {
          ctx.fillText(line, padding + cardInner, noteY + index * 20);
        });
        y += firstPaymentHeight + cardGap;
      }

      drawRoundedRect(
        ctx,
        padding,
        y,
        contentWidth,
        breakdownHeight,
        cardRadius,
        "#eef5f9",
        "#cbdce8",
      );
      ctx.fillStyle = "#668097";
      ctx.font = `700 11px ${fontFamily}`;
      ctx.fillText("D E S G L O S E", padding + cardInner, y + 28);

      y += 50;
      detailRowsForImage.forEach((row) => {
        if (row.label === "Subtotal" || row.strong) {
          ctx.strokeStyle = "#cbdce8";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(padding + cardInner, y);
          ctx.lineTo(padding + contentWidth - cardInner, y);
          ctx.stroke();
        }
        ctx.fillStyle = row.strong ? "#17385f" : "#55728b";
        ctx.font = row.strong ? strongFont : rowFont;
        row.labelLines.forEach((line, index) => {
          ctx.fillText(line, padding + cardInner, y + 20 + index * 20);
        });
        ctx.textAlign = "right";
        ctx.fillStyle = "#17385f";
        ctx.font = row.strong ? strongFont : `600 14px ${fontFamily}`;
        ctx.fillText(row.value, padding + contentWidth - cardInner, y + 20);
        ctx.textAlign = "left";
        if (row.mutedLines.length) {
          ctx.fillStyle = "#668097";
          ctx.font = smallFont;
          row.mutedLines.forEach((line, index) => {
            ctx.fillText(
              line,
              padding + cardInner,
              y + 22 + row.labelLines.length * 20 + index * 16,
            );
          });
        }
        y += row.rowHeight;
      });

      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((value) => resolve(value), "image/png", 0.95);
      });

      if (!blob) {
        throw new Error("No fue posible generar la imagen.");
      }

      if (navigator.clipboard?.write && typeof ClipboardItem !== "undefined") {
        await navigator.clipboard.write([
          new ClipboardItem({ [blob.type || "image/png"]: blob }),
        ]);
        setCopyQuoteImageStatus("La cotización se copió como imagen.");
        return;
      }

      const fileName = `cotizacion-${Date.now()}.png`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);
      setCopyQuoteImageStatus(
        "Tu navegador no permitió copiar la imagen directo. Se descargó un PNG.",
      );
    } catch (error) {
      setCopyQuoteImageStatus(
        error instanceof Error
          ? error.message
          : "No fue posible exportar la cotización como imagen.",
      );
    } finally {
      setCopyQuoteImagePending(false);
    }
  }, [
    resultPanelBase,
    resultPanelBenefitDurationSentence,
    resultPanelBenefitsTotal,
    resultPanelChargeAmount,
    resultPanelChargeLabel,
    resultPanelFinalTotal,
    resultPanelFirstPaymentAmount,
    resultPanelFirstPaymentDurationSentence,
    resultPanelFirstPaymentNotes,
    resultPanelHeroCopy,
    resultPanelPrimaryTotal,
    resultPanelScholarshipAmount,
    resultPanelScholarshipPercent,
    resultPanelScholarshipSubtotal,
    resultPanelSinScholarship,
    resultPanelSnapshot,
    showResultPanelBenefits,
    showResultPanelCharges,
    showResultPanelSecondaryTotal,
  ]);
  
  return (
    <>
    <div className="ui-form-grid ui-form-grid--main-aside">
      <section className="ui-card min-w-0 p-[var(--ui-card-pad)]">
        <h1 className="ui-section-title font-semibold">Calculadora</h1>

        <div className="mt-3 flex flex-wrap items-center gap-2.5">
          <span className="ui-pill ui-pill--accent">Oferta visible en /unidep</span>
          {normalizedVisibleOfferCycles.length === 0 ? (
            <span className="ui-pill">Sin ciclos visibles</span>
          ) : normalizedVisibleOfferCycles.length === 1 ? (
            <span className="ui-pill">{normalizedVisibleOfferCycles[0]}</span>
          ) : (
            <label className="inline-flex items-center gap-2.5">
              <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                Ciclo
              </span>
              <div className="min-w-[132px] sm:min-w-[148px]">
                <SmartSelect
                  value={selectedOfferCycle}
                  placeholder="Ciclo"
                  options={normalizedVisibleOfferCycles.map((cycle) => ({
                    value: cycle,
                    label: cycle,
                  }))}
                  onChange={(value) => setSelectedOfferCycle(value as AcademicOfferCycle)}
                />
              </div>
            </label>
          )}
        </div>
 
        {loading ? (
          <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-3 text-sm text-slate-300">
            Cargando datos...
          </div>
        ) : loadError ? (
          <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-100">
            {loadError}
          </div>
        ) : null}

        <div className="mt-4 grid min-w-0 gap-[var(--ui-card-gap)]">
          <label className="grid min-w-0 gap-2 ui-label">
            <span id={tipoLabelId}>Tipo de inscripción</span>
            <SmartSelect
              labelId={tipoLabelId}
              value={tipo}
              placeholder="Selecciona tipo"
              options={tipoOptions}
              onChange={(v) => setTipo(v as TipoInscripcion)}
            />
          </label>
 
          <div className="ui-form-grid ui-form-grid--two ui-form-grid--four">
            <label className="grid min-w-0 gap-2 ui-label">
              <span id={nivelLabelId}>Línea de negocio</span>
              <SmartSelect
                labelId={nivelLabelId}
                value={nivel}
                placeholder="Selecciona nivel"
                disabled={!rules}
                error={Boolean(calcErr?.missing?.includes("nivel"))}
                options={nivelOptions}
                onChange={(v) => setNivel(v)}
              />
            </label>
 
            <label className="grid min-w-0 gap-2 ui-label">
              <span id={modalidadLabelId}>Modalidad</span>
              <SmartSelect
                labelId={modalidadLabelId}
                value={modalidad}
                placeholder="Selecciona modalidad"
                disabled={!nivel}
                error={Boolean(calcErr?.missing?.includes("modalidad"))}
                options={modalidadOptions}
                onChange={(v) => setModalidad(v)}
              />
            </label>
 
            <label className="grid min-w-0 gap-2 ui-label">
              <span id={planLabelId}>Plan de estudios</span>
              <SmartSelect
                labelId={planLabelId}
                value={plan !== null ? String(plan) : ""}
                placeholder="Selecciona plan"
                disabled={!modalidad}
                error={Boolean(calcErr?.missing?.includes("plan"))}
                options={planOptions}
                onChange={(v) => setPlan(v ? Number(v) : null)}
              />
            </label>
 
            <label className="grid min-w-0 gap-2 ui-label">
              <span id={plantelLabelId}>Plantel</span>
              <SmartSelect
                labelId={plantelLabelId}
                value={plantel}
                placeholder={
                  requierePlantel(nivel, modalidad)
                    ? "Selecciona plantel"
                    : "No es necesario para este nivel o modalidad"
                }
                disabled={!nivel || !modalidad || !plan || !requierePlantel(nivel, modalidad)}
                error={Boolean(calcErr?.missing?.includes("plantel"))}
                options={plantelOptions}
                onChange={(v) => setPlantel(v)}
              />
            </label>
          </div>
 
          <div className="ui-subcard">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.3em] text-slate-400">
                  Oferta del plantel
                </div>
              </div>
              {selectedOfferProgram ? (
                <div className="text-xs text-slate-400">
                  Programa seleccionado:{" "}
                  <span className="text-slate-200">{selectedOfferProgram.programName}</span>
                </div>
              ) : null}
            </div>
              {!canLoadOfferPanel ? (
                <div className="mt-3 text-sm text-slate-300">
                  Sin programa seleccionado.
                </div>
              ) : (
              <div className="mt-4 grid min-w-0 gap-[var(--ui-card-gap)] xl:grid-cols-[minmax(0,1.24fr)_minmax(248px,0.76fr)]">
                <div className="grid min-w-0 gap-3">
                  <label className="grid min-w-0 gap-2 ui-label">
                    <span id={ofertaLabelId}>Programa</span>
                    <SmartSelect
                      labelId={ofertaLabelId}
                      value={offerProgramId}
                      placeholder={
                        offerProgramsLoading
                          ? "Cargando oferta..."
                          : "Selecciona programa"
                      }
                      disabled={offerProgramsLoading || !offerProgramOptions.length}
                      options={offerProgramOptions}
                      onChange={(v) => setOfferProgramId(v)}
                    />
                  </label>
                  {offerProgramsError ? (
                    <div className="text-xs text-red-200">{offerProgramsError}</div>
                  ) : null}
                </div>
                <div className="grid min-w-0 gap-3 rounded-2xl border ui-border bg-slate-950/40 p-[calc(var(--ui-card-pad)*0.9)] text-sm text-slate-200">
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                    <div className="rounded-2xl border border-white/10 bg-black/15 p-3">
                      <div className="text-xs uppercase tracking-[0.22em] text-slate-500">
                        Modalidad ofertada
                      </div>
                      <div className="mt-2 min-w-0 break-words text-base font-semibold text-slate-100">
                        {selectedOfferProgram?.modality ?? "Selecciona un programa"}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/15 p-3">
                      <div className="text-xs uppercase tracking-[0.22em] text-slate-500">
                        Horario
                      </div>
                      <div className="mt-2 min-w-0 break-words text-base font-semibold text-slate-100">
                        {selectedOfferProgram?.schedule ?? "No disponible"}
                      </div>
                    </div>
                  </div>
                  <div>
                    {selectedOfferProgram?.planLink ? (
                      <a
                        href={selectedOfferProgram.planLink}
                        target="_blank"
                        rel="noreferrer"
                        className="ui-button-secondary inline-flex min-h-9 rounded-xl px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(31,108,140,0.3)]"
                      >
                        Descargar plan de estudios
                      </a>
                    ) : (
                      <button
                        type="button"
                        disabled
                        className="inline-flex cursor-not-allowed rounded-xl border border-white/10 bg-white/5 px-3 py-2 ui-label text-slate-400"
                      >
                        Plan no disponible
                      </button>
                    )}
                  </div>
                </div>
                <div className="sr-only" aria-live="polite">
                  Programa seleccionado: {offerSelectedProgramId || "ninguno"}
                </div>
              </div>
            )}
          </div>

          <div className={["ui-form-grid", shouldShowMaterias(tipo, nivel) ? "ui-form-grid--two" : ""].join(" ")}>
            {shouldShowMaterias(tipo, nivel) ? (
              <label className="grid min-w-0 gap-2 ui-label">
                <span id={materiasLabelId}>Materias inscritas</span>
                <SmartSelect
                  labelId={materiasLabelId}
                  value={materias !== null ? String(materias) : ""}
                  placeholder="Selecciona materias"
                  disabled={!plantel && requierePlantel(nivel, modalidad)}
                  error={Boolean(calcErr?.missing?.includes("materias"))}
                  options={materiasOptionsUi}
                  onChange={(v) => setMaterias(v ? Number(v) : null)}
                />
              </label>
            ) : null}

            <label className="grid min-w-0 gap-2 ui-label">
              <span id={promedioLabelId}>Promedio (0 a 10)</span>
              <input
                aria-labelledby={promedioLabelId}
                value={promedio}
                onChange={(e) => setPromedio(e.target.value)}
                inputMode="decimal"
                placeholder="Ej. 8.5"
                className={inputClass(Boolean(calcErr?.missing?.includes("promedio")))}
                aria-invalid={calcErr?.missing?.includes("promedio") ? "true" : "false"}
              />
            </label>
          </div>

          <div className="ui-form-grid ui-form-grid--two">
            <div className="ui-subcard ui-benefit-status-card">
              <div className="ui-panel-kicker">
                Beneficio adicional
              </div>
              {beneficioBlockedByTipo ? (
                <div className="mt-2 text-sm font-medium text-[color:var(--ui-text-secondary)]">
                  Los beneficios adicionales <span className="font-semibold text-[color:var(--ui-text-primary)]">no aplican para Regresos</span>.
                </div>
              ) : (
                <>
                  <div className="mt-2 text-sm font-medium text-[color:var(--ui-text-primary)]">
                    <span className="font-semibold">Estado:</span>{" "}
                    <span
                      className={
                        beneficioAplica
                          ? "font-semibold text-[color:var(--ui-institutional-green)]"
                          : "text-[color:var(--ui-text-secondary)]"
                      }
                    >
                      {effectiveBenefitLoading
                        ? "Consultando..."
                        : beneficioAplica
                          ? "Aplica"
                          : "No aplica"}
                    </span>
                  </div>
                  {effectiveBenefitError ? (
                    <div className="mt-2 text-xs font-medium text-red-700">{effectiveBenefitError}</div>
                  ) : null}
                  {beneficioAplica ? (
                    <div className="mt-2 text-sm font-semibold text-[color:var(--ui-text-primary)]">
                      {beneficioPercent}% adicional
                    </div>
                  ) : null}
                  {beneficioDurationSentence ? (
                    <div className="mt-2 text-xs text-[color:var(--ui-text-secondary)]">
                      {beneficioDurationSentence}
                    </div>
                  ) : null}
                </>
              )}
            </div>

            <div className="ui-subcard">
              <div className="flex flex-col gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={cargoEnabled}
                    onChange={(e) => setCargoEnabled(e.target.checked)}
                  />
                  Agregar cargo académico
                </label>
                {cargoEnabled ? (
                  <div className="ui-form-grid ui-form-grid--two">
                    <div className="grid min-w-0 gap-2 ui-label">
                      <span id={cargoTypeLabelId}>Tipo de cargo</span>
                      <SmartSelect
                        labelId={cargoTypeLabelId}
                        value={cargoType}
                        placeholder="Selecciona cargo"
                        error={Boolean(calcErr?.missing?.includes("cargoType"))}
                        options={cargoOptions}
                        onChange={(v) => setCargoType(v)}
                      />
                    </div>
                    <label className="grid min-w-0 gap-2 ui-label">
                      <span id={cargoAmountLabelId}>Monto automático</span>
                      <input
                        aria-labelledby={cargoAmountLabelId}
                        value={cargoAmount}
                        inputMode="decimal"
                        placeholder={
                          cargoType
                            ? academicFeesLoading
                              ? "Consultando costo..."
                              : "Se llena automáticamente"
                            : "Selecciona un cargo"
                        }
                        readOnly
                        className={inputClass(
                          Boolean(calcErr?.missing?.includes("cargoAmount"))
                        )}
                      />
                    </label>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
 
          {calcError ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              <div className="font-semibold text-red-900">{calcError}</div>
              {calcErr?.hint ? (
                <div className="mt-2 text-sm font-medium text-red-800">{calcErr.hint}</div>
              ) : null}
              {calcErr?.ranges?.length ? (
                <div className="mt-3 text-xs font-medium text-red-700">
                  Rangos válidos: {calcErr.ranges.join(", ")}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>
  
      <aside className="ui-scrollbar grid min-w-0 content-start gap-[var(--ui-shell-gap)] xl:sticky xl:top-[calc(var(--ui-shell-pad-y)+2px)] xl:max-h-[calc(100dvh-(var(--ui-shell-pad-y)*2))] xl:self-start xl:overflow-y-auto xl:pr-1">
        {!hideActionRail &&
        (ctasAboveResult.length > 0 || resultAboveAnnouncements.length > 0) ? (
          <section className="rounded-2xl border border-white/10 bg-slate-950/32 p-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.26em] text-slate-400">
              Actions
            </div>
            <AnnouncementOutlet
              announcements={resultAboveAnnouncements}
              className="mt-3 grid gap-2"
            />
            {ctasAboveResult.length ? (
              <ConfiguredCtaList
                ctas={ctasAboveResult}
                className="mt-3 flex flex-wrap gap-2"
                appearance="pill"
                onCtaClick={trackConfiguredResultCta}
              />
            ) : null}
          </section>
        ) : null}

        <section className="ui-card ui-card-pad min-w-0">
          <div className="grid gap-4">
            <h2 className="ui-label font-semibold uppercase tracking-[0.35em] text-slate-300">
              Cotización
            </h2>
            {activeScenarioResult && !currentSimulatorResult ? (
              <div className="rounded-2xl border border-cyan-400/25 bg-cyan-500/5 px-3 py-2 text-[11px] uppercase tracking-[0.22em] text-cyan-100">
                Escenario cargado
              </div>
            ) : null}

            {!resultPanelSnapshot ? (
              <div className="text-sm text-slate-300">
                Sin cotización actual.
              </div>
            ) : (
              <div className="grid gap-4" data-testid="results-panel">
              <div className="ui-institutional-panel ui-result-hero rounded-[28px] border p-4">
                <div>
                  <div className="ui-result-hero__kicker">
                    Costo mensual
                  </div>
                  <div
                    className="ui-result-hero__amount mt-2"
                    data-testid="results-total-amount"
                  >
                    {formatMoney(resultPanelFinalTotal)}
                  </div>
                  <div className="ui-result-hero__copy mt-2">
                    {resultPanelHeroCopy}
                  </div>
                </div>
              </div>

              {resultPanelFirstPaymentAmount > 0 ? (
                <div className="ui-institutional-callout rounded-2xl border px-4 py-3">
                  <div className="ui-panel-kicker">
                    Primer pago
                  </div>
                  <div className="mt-1 text-lg font-semibold text-[color:var(--ui-text-primary)]">
                    {formatMoney(resultPanelFirstPaymentAmount)}
                  </div>
                  {resultPanelFirstPaymentDurationSentence ? (
                    <div className="mt-1 text-xs text-[color:var(--ui-text-secondary)]">
                      {resultPanelFirstPaymentDurationSentence}
                    </div>
                  ) : null}
                  {resultPanelFirstPaymentNotes ? (
                    <div className="mt-2 text-sm leading-5 text-[color:var(--ui-text-primary)]">
                      {resultPanelFirstPaymentNotes}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {resultInsideAnnouncements.length > 0 ? (
                <AnnouncementOutlet
                  announcements={resultInsideAnnouncements}
                  className="grid gap-2"
                />
              ) : null}
              {ctasInsideResult.length > 0 ? (
                <div className="mt-3">
                  <ConfiguredCtaList
                    ctas={ctasInsideResult}
                    className="flex flex-wrap gap-2"
                    appearance="pill"
                    onCtaClick={trackConfiguredResultCta}
                  />
                </div>
              ) : null}

              <div className="rounded-2xl border border-white/10 bg-slate-950/20 p-4">
                <div className="text-xs uppercase tracking-[0.28em] text-slate-400">
                  Desglose
                </div>
                <div className="mt-3 grid gap-2.5 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300">Precio lista</span>
                    <span className="font-semibold text-white">
                      {formatMoney(resultPanelBase)}
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-slate-300">
                        Beca {resultPanelScholarshipPercent ? formatPercent(resultPanelScholarshipPercent) : ""}
                      </div>
                      {resultPanelSinScholarship ? (
                        <div className="text-xs text-slate-400">Sin acceso a beca</div>
                      ) : null}
                    </div>
                    <span className="text-slate-100">
                      -{formatMoney(resultPanelScholarshipAmount)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-t border-white/10 pt-3">
                    <span className="text-slate-300">Subtotal</span>
                    <span className="font-semibold text-white">
                      {formatMoney(resultPanelScholarshipSubtotal)}
                    </span>
                  </div>

                  {showResultPanelBenefits ? (
                    <div className="grid gap-2 rounded-2xl border border-white/10 bg-white/[0.025] px-3 py-3">
                      <div className="text-[11px] uppercase tracking-[0.24em] text-slate-400">
                        Beneficios
                      </div>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-slate-300">Beneficio adicional</div>
                          {resultPanelBenefitDurationSentence ? (
                            <div className="text-xs text-slate-400">
                              {resultPanelBenefitDurationSentence}
                            </div>
                          ) : null}
                        </div>
                        <span className="text-slate-100">
                          -{formatMoney(resultPanelBenefitsTotal)}
                        </span>
                      </div>
                    </div>
                  ) : null}

                  {showResultPanelCharges && !showResultPanelSecondaryTotal ? (
                    <div className="grid gap-2 rounded-2xl border border-white/10 bg-white/[0.025] px-3 py-3">
                      <div className="text-[11px] uppercase tracking-[0.24em] text-slate-400">
                        Costos adicionales
                      </div>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-slate-300">{resultPanelChargeLabel}</div>
                          <div className="text-xs text-slate-400">Cargo académico aplicado.</div>
                        </div>
                        <span className="text-slate-100">
                          {formatMoney(resultPanelChargeAmount)}
                        </span>
                      </div>
                    </div>
                  ) : null}

                  <div className="flex items-center justify-between border-t border-white/10 pt-3 text-base font-semibold text-white">
                    <span>Total</span>
                    <span>{formatMoney(resultPanelPrimaryTotal)}</span>
                  </div>

                  {showResultPanelSecondaryTotal ? (
                    <div className="grid gap-2 rounded-2xl border border-white/10 bg-white/[0.025] px-3 py-3">
                      <div className="text-[11px] uppercase tracking-[0.24em] text-slate-400">
                        Costos adicionales
                      </div>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-slate-300">{resultPanelChargeLabel}</div>
                          <div className="text-xs text-slate-400">Cargo académico aplicado.</div>
                        </div>
                        <span className="text-slate-100">
                          {formatMoney(resultPanelChargeAmount)}
                        </span>
                      </div>
                    </div>
                  ) : null}

                  {showResultPanelSecondaryTotal ? (
                    <div className="flex items-center justify-between border-t border-white/10 pt-3 text-base font-semibold text-white">
                      <span>Total ya con cargos aplicados</span>
                      <span>{formatMoney(resultPanelFinalTotal)}</span>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
            )}
          </div>

          {resultPanelSnapshot ? (
            <div className="mt-4 grid gap-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-slate-400">
                  Copia este panel como imagen para compartir la cotización visible.
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowPaymentPlan((value) => !value)}
                    className="ui-button-secondary min-h-9 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em]"
                    aria-expanded={showPaymentPlan}
                  >
                    Plan de pagos
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleCopyQuoteImage()}
                    disabled={copyQuoteImagePending}
                    className="ui-button-secondary min-h-9 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] disabled:opacity-60"
                  >
                    {copyQuoteImagePending ? "Generando..." : "Copiar como imagen"}
                  </button>
                </div>
              </div>

              {copyQuoteImageStatus ? (
                <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/5 px-4 py-3 text-sm text-cyan-50/90">
                  {copyQuoteImageStatus}
                </div>
              ) : null}

              {showPaymentPlan ? (
                <section className="ui-institutional-callout rounded-2xl border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="ui-panel-kicker">Plan de pagos</div>
                      <div className="mt-1 text-sm text-[color:var(--ui-text-secondary)]">
                        Muestra mensualidades y pagos de incorporación por cuatrimestre.
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3">
                    {paymentPlanSections.map((section) => {
                      const sectionTotal = round2(
                        section.rows.reduce((total, row) => total + row.amount, 0),
                      );

                      return (
                      <div
                        key={section.title}
                        className="grid gap-2 rounded-2xl border border-[color:var(--ui-border)] bg-white/80 p-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="text-sm font-semibold text-[color:var(--ui-text-primary)]">
                            {section.title}
                          </div>
                          <div className="shrink-0 text-right text-sm font-semibold text-[color:var(--ui-text-primary)]">
                            {formatMoney(sectionTotal)}
                          </div>
                        </div>
                        {section.rows.map((row) => (
                          <div
                            key={`${section.title}-${row.label}-${row.detail}`}
                            className="flex items-start justify-between gap-3 rounded-xl border border-[color:var(--ui-border)] bg-white px-3 py-2"
                          >
                            <div className="min-w-0 break-words">
                              <div className="text-sm font-semibold leading-5 text-[color:var(--ui-text-primary)]">
                                {row.label}
                              </div>
                              <div className="text-xs leading-4 text-[color:var(--ui-text-secondary)]">
                                {row.detail}
                              </div>
                            </div>
                            <div className="shrink-0 text-right text-sm font-semibold text-[color:var(--ui-text-primary)]">
                              {formatMoney(row.amount)}
                            </div>
                          </div>
                        ))}
                      </div>
                      );
                    })}
                  </div>
                </section>
              ) : null}

              <details className="rounded-2xl border border-white/10 bg-slate-950/20 p-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                  <div className="text-xs uppercase tracking-[0.28em] text-slate-400">
                    Template para Whatsapp
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-200">
                    Abrir
                  </span>
                </summary>
                <div className="mt-4">
                  <ResultsWhatsappTemplatePanel
                    initialCollection={whatsappTemplates}
                    previewData={whatsappPreviewData}
                  />
                </div>
              </details>
            </div>
          ) : null}
 
          {/* Admin debug panel removed — CTAs are now sourced from admin locations */}
        </section>

        {belowResultSlot}
      </aside>
    </div>
    <FloatingCalculator />
    </>
  );
}
 
