import {
  buildWhatsappTemplatePreview,
  listWhatsappTemplatesForUser,
  type SerializableWhatsappTemplate,
  type WhatsappTemplatePreviewData,
} from "@/lib/whatsapp-templates";
import { isCloudflareRuntime } from "@/lib/cloudflare/runtime";

const currency = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 2,
});

export type ExtensionQuoteDraftInput = {
  campus?: string | null;
  businessLine?: string | null;
  modality?: string | null;
  plan?: number | string | null;
  enrollmentType?: string | null;
  program?: string | null;
  totalMxn?: number | null;
  basePriceMxn?: number | null;
  scholarshipPercent?: number | null;
  firstPaymentAmountMxn?: number | null;
  additionalBenefitDuration?: string | null;
  additionalBenefitNotes?: string | null;
};

function toLabel(value: string | null | undefined) {
  return String(value ?? "").replace(/\s+/g, " ").trim() || null;
}

function titleCase(value: string | null | undefined) {
  const normalized = toLabel(value);
  if (!normalized) return null;
  return normalized
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatBusinessLine(value: string | null | undefined) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) return null;
  if (["prepa", "preparatoria", "bachillerato", "bachiller"].includes(normalized)) {
    return "Bachillerato";
  }
  if (normalized === "salud") return "Salud";
  if (["licenciatura", "lic"].includes(normalized)) return "Licenciatura";
  if (["maestria", "maestría", "doctorado", "posgrado"].includes(normalized)) {
    return "Posgrado";
  }
  return titleCase(normalized);
}

function formatModality(value: string | null | undefined) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === "mixta") return "Mixta";
  if (normalized === "online") return "Online";
  if (normalized === "presencial") return "Presencial";
  return titleCase(normalized);
}

function formatEnrollmentType(value: string | null | undefined) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === "nuevo_ingreso") return "Nuevo ingreso";
  if (normalized === "reingreso") return "Reingreso";
  if (normalized === "regreso") return "Regreso";
  return titleCase(normalized);
}

function formatMoney(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return currency.format(Math.round(value * 100) / 100);
}

function resolveActiveTemplate(
  templates: Awaited<ReturnType<typeof listWhatsappTemplatesForUser>>["templates"],
  activeTemplateId: string | null,
  defaultOfficialTemplateId: string | null,
) {
  return (
    templates.find((template) => template.id === activeTemplateId) ??
    templates.find((template) => template.id === defaultOfficialTemplateId) ??
    templates[0] ??
    null
  );
}

export function buildExtensionWhatsappPreviewData(
  input: ExtensionQuoteDraftInput,
): WhatsappTemplatePreviewData {
  const scholarshipPercent =
    typeof input.scholarshipPercent === "number" &&
    Number.isFinite(input.scholarshipPercent)
      ? `${input.scholarshipPercent}%`
      : null;

  const additionalBenefitDuration = toLabel(input.additionalBenefitDuration);
  const additionalBenefitNotes = toLabel(input.additionalBenefitNotes);

  return {
    campusLabel: toLabel(input.campus),
    programLabel: toLabel(input.program) ?? formatBusinessLine(input.businessLine),
    businessLineLabel: formatBusinessLine(input.businessLine),
    modalityLabel: formatModality(input.modality),
    planLabel:
      input.plan === null || input.plan === undefined || input.plan === ""
        ? null
        : `Plan ${String(input.plan).trim()}`,
    enrollmentTypeLabel: formatEnrollmentType(input.enrollmentType),
    scheduleLabel: null,
    listPrice: typeof input.basePriceMxn === "number" ? input.basePriceMxn : null,
    scholarshipText: scholarshipPercent ? `Beca ${scholarshipPercent}` : "Sin beca",
    scholarshipPercentText: scholarshipPercent,
    scholarshipAmountText: null,
    additionalBenefitText:
      additionalBenefitDuration || additionalBenefitNotes
        ? [additionalBenefitDuration, additionalBenefitNotes].filter(Boolean).join(" · ")
        : null,
    additionalBenefitPercentText: null,
    additionalBenefitAmountText: null,
    firstPaymentText: formatMoney(input.firstPaymentAmountMxn),
    additionalChargeText: null,
    subtotal:
      typeof input.totalMxn === "number" && Number.isFinite(input.totalMxn)
        ? input.totalMxn
        : null,
    total:
      typeof input.totalMxn === "number" && Number.isFinite(input.totalMxn)
        ? input.totalMxn
        : null,
    notes: additionalBenefitNotes,
    callToAction:
      "Si te interesa, te ayudo a continuar con inscripción, documentos y siguiente paso.",
  };
}

function buildFallbackMessage(previewData: WhatsappTemplatePreviewData) {
  const lines = [
    "Hola, te comparto tu cotización estimada.",
    previewData.programLabel ? `Programa: ${previewData.programLabel}` : null,
    previewData.modalityLabel ? `Modalidad: ${previewData.modalityLabel}` : null,
    previewData.planLabel ? `${previewData.planLabel}` : null,
    previewData.scholarshipText ? `${previewData.scholarshipText}` : null,
    previewData.total ? `Total estimado: ${formatMoney(previewData.total)}` : null,
    previewData.callToAction,
  ].filter(Boolean);

  return lines.join("\n");
}

export async function renderActiveExtensionWhatsappDraft(params: {
  userId: string;
  quote: ExtensionQuoteDraftInput;
}) {
  if (isCloudflareRuntime()) {
    const previewData = buildExtensionWhatsappPreviewData(params.quote);
    return {
      template: null,
      previewData,
      messageText: buildFallbackMessage(previewData),
    };
  }

  const collection = await listWhatsappTemplatesForUser(params.userId);
  const template = resolveActiveTemplate(
    collection.templates,
    collection.activeTemplateId,
    collection.defaultOfficialTemplateId,
  );
  const previewData = buildExtensionWhatsappPreviewData(params.quote);
  const messageText = template
    ? buildWhatsappTemplatePreview(
        template as Pick<SerializableWhatsappTemplate, "baseText" | "fieldOrder">,
        previewData,
      )
    : buildFallbackMessage(previewData);

  return {
    template: template
      ? {
          id: template.id,
          name: template.name,
          kind: template.kind,
        }
      : null,
    previewData,
    messageText,
  };
}
