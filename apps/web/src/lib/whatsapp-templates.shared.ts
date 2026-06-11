const currency = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 2,
});

const round2 = (value: number) => Math.round(value * 100) / 100;

const formatMoney = (value: number | null | undefined) =>
  typeof value === "number" && Number.isFinite(value)
    ? currency.format(round2(value))
    : "-";

const compactInlineText = (value: string | null | undefined) =>
  value?.replace(/\s+/g, " ").trim() ?? "";

export type WhatsappTemplateKind = "summary" | "detailed";

export type WhatsappTemplateStatus =
  | "personal"
  | "submitted_for_review"
  | "approved"
  | "rejected"
  | "official"
  | "archived";

export function normalizeWhatsappTemplateBaseText(value: string | null | undefined) {
  const normalized = String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n")
    .trim();

  return normalized || null;
}

export const WHATSAPP_TEMPLATE_KINDS = [
  {
    value: "summary",
    label: "Resumen",
    description: "Version corta para compartir rapido por telefono o WhatsApp.",
  },
  {
    value: "detailed",
    label: "Completo",
    description: "Incluye desglose y mas contexto comercial.",
  },
] as const;

export const WHATSAPP_TEMPLATE_FIELDS = [
  {
    key: "campus",
    label: "Plantel",
    description: "Plantel o sede seleccionada.",
  },
  {
    key: "program",
    label: "Programa",
    description: "Programa o carrera listos para compartir en la conversacion.",
  },
  {
    key: "business_line",
    label: "Linea",
    description: "Linea academica en formato corto.",
  },
  {
    key: "modality",
    label: "Modalidad",
    description: "Modalidad academica.",
  },
  {
    key: "plan",
    label: "Plan",
    description: "Plan de estudios o version del programa.",
  },
  {
    key: "enrollment_type",
    label: "Tipo",
    description: "Tipo de inscripcion.",
  },
  {
    key: "schedule",
    label: "Horario",
    description: "Horario o turno detectado.",
  },
  {
    key: "list_price",
    label: "Precio lista",
    description: "Costo base antes de becas o ajustes.",
  },
  {
    key: "scholarship",
    label: "Beca",
    description: "Como se explicara la beca dentro del mensaje.",
  },
  {
    key: "scholarship_percent",
    label: "% Beca",
    description: "Porcentaje de descuento de la beca. Ej: 30%",
  },
  {
    key: "scholarship_amount",
    label: "Monto beca",
    description: "Monto de descuento de la beca. Ej: $10,000",
  },
  {
    key: "additional_benefit",
    label: "Beneficio adicional",
    description: "Beneficio complementario listo para conversacion.",
  },
  {
    key: "additional_benefit_percent",
    label: "% Beneficio adicional",
    description: "Porcentaje del beneficio adicional. Ej: 10%",
  },
  {
    key: "additional_benefit_amount",
    label: "Monto beneficio adicional",
    description: "Monto del beneficio adicional. Ej: $3,000",
  },
  {
    key: "first_payment",
    label: "Primer pago",
    description: "Monto de referencia del primer pago, fuera de la suma principal.",
  },
  {
    key: "additional_charge",
    label: "Cargo adicional",
    description: "Cargo academico agregado si existe.",
  },
  {
    key: "subtotal",
    label: "Colegiatura mensual",
    description: "Subtotal mensual despues de beca y beneficio adicional.",
  },
  {
    key: "total",
    label: "Total",
    description: "Monto final a cubrir cuando existan cargos adicionales.",
  },
  {
    key: "notes",
    label: "Observaciones",
    description: "Notas o condiciones relevantes para seguimiento.",
  },
  {
    key: "call_to_action",
    label: "Cierre",
    description: "Llamado a la accion listo para enviar.",
  },
] as const;

export type WhatsappTemplateFieldKey = (typeof WHATSAPP_TEMPLATE_FIELDS)[number]["key"];

export type WhatsappTemplateFieldDefinition = (typeof WHATSAPP_TEMPLATE_FIELDS)[number];

export type WhatsappTemplatePreviewData = {
  campusLabel: string | null;
  programLabel: string | null;
  businessLineLabel: string | null;
  modalityLabel: string | null;
  planLabel: string | null;
  enrollmentTypeLabel: string | null;
  scheduleLabel: string | null;
  listPrice: number | null;
  scholarshipText: string | null;
  scholarshipPercentText: string | null;
  scholarshipAmountText: string | null;
  additionalBenefitText: string | null;
  additionalBenefitPercentText: string | null;
  additionalBenefitAmountText: string | null;
  firstPaymentText: string | null;
  additionalChargeText: string | null;
  subtotal: number | null;
  total: number | null;
  notes: string | null;
  callToAction: string | null;
};

export const WHATSAPP_TEMPLATE_POSITIONAL_CATALOG = WHATSAPP_TEMPLATE_FIELDS.map(
  (field, index) => ({
    position: index + 1,
    token: `{{${index + 1}}}`,
    key: field.key,
    label: field.label,
    description: field.description,
  }),
);

export type SerializableWhatsappTemplate = {
  id: string;
  systemKey: string | null;
  name: string;
  kind: WhatsappTemplateKind;
  status: WhatsappTemplateStatus;
  isDefaultOfficial: boolean;
  baseText: string | null;
  fieldOrder: number[];
  sourceTemplateId: string | null;
  ownerUserId: string | null;
  authorUserId: string | null;
  reviewNotes: string | null;
  reviewedByEmail: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  isOfficial: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canSubmitForReview: boolean;
};

export type WhatsappTemplateCollection = {
  templates: SerializableWhatsappTemplate[];
  activeTemplateId: string | null;
  defaultOfficialTemplateId: string | null;
};

export type AdminWhatsappTemplateQueueItem = SerializableWhatsappTemplate & {
  ownerEmail: string | null;
  authorEmail: string | null;
  preview: string;
};

export type AdminOfficialWhatsappTemplateItem = SerializableWhatsappTemplate & {
  preview: string;
};

const FIELD_KEYS = new Set<WhatsappTemplateFieldKey>(
  WHATSAPP_TEMPLATE_FIELDS.map((field) => field.key),
);
const FIELD_POSITION_BY_KEY = new Map<WhatsappTemplateFieldKey, number>(
  WHATSAPP_TEMPLATE_POSITIONAL_CATALOG.map((field) => [field.key, field.position]),
);
const FIELD_KEY_BY_POSITION = new Map<number, WhatsappTemplateFieldKey>(
  WHATSAPP_TEMPLATE_POSITIONAL_CATALOG.map((field) => [field.position, field.key]),
);

const EMPTY_PREVIEW_DATA: WhatsappTemplatePreviewData = {
  campusLabel: null,
  programLabel: null,
  businessLineLabel: null,
  modalityLabel: null,
  planLabel: null,
  enrollmentTypeLabel: null,
  scheduleLabel: null,
  listPrice: null,
  scholarshipText: null,
  scholarshipPercentText: null,
  scholarshipAmountText: null,
  additionalBenefitText: null,
  additionalBenefitPercentText: null,
  additionalBenefitAmountText: null,
  firstPaymentText: null,
  additionalChargeText: null,
  subtotal: null,
  total: null,
  notes: null,
  callToAction: null,
};

export function normalizeWhatsappTemplateFieldOrder(
  messageText: string | null | undefined,
): number[] {
  if (!messageText) return [];
  const matches = new Set<number>();
  const regex = /\{\{\s*(\d+)\s*\}\}/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(messageText)) !== null) {
    const pos = parseInt(match[1], 10);
    if (pos >= 1 && pos <= WHATSAPP_TEMPLATE_FIELDS.length) {
      matches.add(pos);
    }
  }
  return Array.from(matches).sort((a, b) => a - b);
}

const TOKEN_PATTERN = /\{\{\s*([a-z0-9_]+)\s*\}\}/gi;
const HAS_INLINE_TEMPLATE_TOKEN = /\{\{\s*([a-z0-9_]+)\s*\}\}/i;

function normalizePersistedWhatsappTemplateFieldOrder(fieldOrder: unknown): number[] {
  if (!Array.isArray(fieldOrder)) return [];

  const positions = fieldOrder.flatMap((value) => {
    if (typeof value === "number" && Number.isInteger(value)) {
      return [value];
    }

    const normalized = String(value ?? "").trim().toLowerCase();
    if (!normalized) return [];
    if (/^\d+$/.test(normalized)) {
      return [Number(normalized)];
    }

    const mappedPosition = FIELD_POSITION_BY_KEY.get(
      normalized as WhatsappTemplateFieldKey,
    );
    return mappedPosition ? [mappedPosition] : [];
  });

  return Array.from(
    new Set(
      positions.filter(
        (position): position is number =>
          Number.isInteger(position) &&
          position >= 1 &&
          position <= WHATSAPP_TEMPLATE_FIELDS.length,
      ),
    ),
  ).sort((left, right) => left - right);
}

function deriveWhatsappTemplateFieldOrder(
  baseText: string | null | undefined,
  compatibilityFieldOrder?: unknown,
) {
  const derivedFromBaseText = normalizeWhatsappTemplateFieldOrder(baseText);
  if (derivedFromBaseText.length) {
    return derivedFromBaseText;
  }

  return normalizePersistedWhatsappTemplateFieldOrder(compatibilityFieldOrder);
}

function resolveTemplateFieldKey(tokenKey: string): WhatsappTemplateFieldKey | null {
  if (/^\d+$/.test(tokenKey)) {
    return FIELD_KEY_BY_POSITION.get(Number(tokenKey)) ?? null;
  }

  if (FIELD_KEYS.has(tokenKey as WhatsappTemplateFieldKey)) {
    return tokenKey as WhatsappTemplateFieldKey;
  }

  return null;
}

function buildPreviewValueMap(data: WhatsappTemplatePreviewData) {
  return {
    campus: compactInlineText(data.campusLabel) || "-",
    program: compactInlineText(data.programLabel) || "-",
    business_line: compactInlineText(data.businessLineLabel) || "-",
    modality: compactInlineText(data.modalityLabel) || "-",
    plan: compactInlineText(data.planLabel) || "-",
    enrollment_type: compactInlineText(data.enrollmentTypeLabel) || "-",
    schedule: compactInlineText(data.scheduleLabel) || "-",
    list_price: formatMoney(data.listPrice),
    scholarship: compactInlineText(data.scholarshipText) || "-",
    scholarship_percent: compactInlineText(data.scholarshipPercentText) || "-",
    scholarship_amount: compactInlineText(data.scholarshipAmountText) || "-",
    additional_benefit: compactInlineText(data.additionalBenefitText) || "-",
    additional_benefit_percent:
      compactInlineText(data.additionalBenefitPercentText) || "-",
    additional_benefit_amount:
      compactInlineText(data.additionalBenefitAmountText) || "-",
    first_payment: compactInlineText(data.firstPaymentText) || "-",
    additional_charge: compactInlineText(data.additionalChargeText) || "-",
    subtotal: formatMoney(data.subtotal),
    total: formatMoney(data.total),
    notes: compactInlineText(data.notes) || "-",
    call_to_action: compactInlineText(data.callToAction) || "-",
  } as const;
}

export function validateWhatsappTemplateBaseText(
  baseText: string | null | undefined,
): void {
  const normalizedBaseText = normalizeWhatsappTemplateBaseText(baseText);
  if (!normalizedBaseText) return;

  const invalidTokens = new Set<string>();
  for (const match of normalizedBaseText.matchAll(TOKEN_PATTERN)) {
    const tokenKey = String(match[1] ?? "").trim().toLowerCase();
    if (!tokenKey) continue;

    if (/^\d+$/.test(tokenKey)) {
      const position = Number(tokenKey);
      if (
        !Number.isInteger(position) ||
        position < 1 ||
        position > WHATSAPP_TEMPLATE_FIELDS.length
      ) {
        invalidTokens.add(`{{${tokenKey}}}`);
      }
      continue;
    }

    invalidTokens.add(`{{${tokenKey}}}`);
  }

  if (invalidTokens.size) {
    throw new Error(`invalid_template_tokens:${Array.from(invalidTokens).join(",")}`);
  }
}

function renderTemplateBaseText(params: {
  baseText: string | null;
  previewValues: ReturnType<typeof buildPreviewValueMap>;
}) {
  if (!params.baseText) {
    return {
      renderedBaseText: "",
      embeddedFieldKeys: new Set<WhatsappTemplateFieldKey>(),
    };
  }

  const embeddedFieldKeys = new Set<WhatsappTemplateFieldKey>();
  const renderedBaseText = params.baseText.replace(
    TOKEN_PATTERN,
    (_match, rawTokenKey: string) => {
      const tokenKey = String(rawTokenKey ?? "").trim().toLowerCase();
      const fieldKey = resolveTemplateFieldKey(tokenKey);
      if (!fieldKey) return "-";
      embeddedFieldKeys.add(fieldKey);
      return params.previewValues[fieldKey];
    },
  );

  return {
    renderedBaseText,
    embeddedFieldKeys,
  };
}

export function buildWhatsappTemplatePreview(
  template: {
    baseText?: string | null;
    fieldOrder?: unknown;
  },
  previewData: WhatsappTemplatePreviewData,
) {
  const data = {
    ...EMPTY_PREVIEW_DATA,
    ...previewData,
  };

  const previewValues = buildPreviewValueMap(data);
  const fieldLines: Record<WhatsappTemplateFieldKey, string> = {
    campus: `Plantel: ${previewValues.campus}`,
    program: `Programa: ${previewValues.program}`,
    business_line: `Linea: ${previewValues.business_line}`,
    modality: `Modalidad: ${previewValues.modality}`,
    plan: `Plan: ${previewValues.plan}`,
    enrollment_type: `Tipo: ${previewValues.enrollment_type}`,
    schedule: `Horario: ${previewValues.schedule}`,
    list_price: `Precio lista: ${previewValues.list_price}`,
    scholarship: `Beca: ${previewValues.scholarship}`,
    scholarship_percent: `% Beca: ${previewValues.scholarship_percent}`,
    scholarship_amount: `Monto beca: ${previewValues.scholarship_amount}`,
    additional_benefit: `Beneficio adicional: ${previewValues.additional_benefit}`,
    additional_benefit_percent: `% Beneficio adicional: ${previewValues.additional_benefit_percent}`,
    additional_benefit_amount: `Monto beneficio adicional: ${previewValues.additional_benefit_amount}`,
    first_payment: `Primer pago: ${previewValues.first_payment}`,
    additional_charge: `Cargo adicional: ${previewValues.additional_charge}`,
    subtotal: `Subtotal: ${previewValues.subtotal}`,
    total: `Total final: ${previewValues.total}`,
    notes: `Observaciones: ${previewValues.notes}`,
    call_to_action: `Siguiente paso: ${previewValues.call_to_action}`,
  };
  const normalizedBaseText = normalizeWhatsappTemplateBaseText(template.baseText);
  const hasInlineVariables = normalizedBaseText
    ? HAS_INLINE_TEMPLATE_TOKEN.test(normalizedBaseText)
    : false;
  const { renderedBaseText, embeddedFieldKeys } = renderTemplateBaseText({
    baseText: normalizedBaseText,
    previewValues,
  });

  if (hasInlineVariables) {
    return renderedBaseText;
  }

  const appendedLines = deriveWhatsappTemplateFieldOrder(
    normalizedBaseText,
    template.fieldOrder,
  )
    .map((position) => FIELD_KEY_BY_POSITION.get(position))
    .filter((fieldKey): fieldKey is WhatsappTemplateFieldKey => Boolean(fieldKey))
    .filter((fieldKey) => !embeddedFieldKeys.has(fieldKey))
    .map((fieldKey) => fieldLines[fieldKey])
    .join("\n");

  return [renderedBaseText, appendedLines]
    .filter((line): line is string => Boolean(line))
    .join("\n\n");
}
