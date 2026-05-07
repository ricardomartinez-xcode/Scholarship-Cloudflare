import {
  Prisma,
  WhatsappTemplateKind,
  WhatsappTemplateStatus,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";

const currency = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 2,
});

const round2 = (value: number) => Math.round(value * 100) / 100;

const formatMoney = (value: number | null | undefined) =>
  typeof value === "number" && Number.isFinite(value)
    ? currency.format(round2(value))
    : "—";

const compactInlineText = (value: string | null | undefined) =>
  value?.replace(/\s+/g, " ").trim() ?? "";

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
    description: "Versión corta para compartir rápido por teléfono o WhatsApp.",
  },
  {
    value: "detailed",
    label: "Completo",
    description: "Incluye desglose y más contexto comercial.",
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
    description: "Programa o carrera listos para compartir en la conversación.",
  },
  {
    key: "business_line",
    label: "Línea",
    description: "Línea académica en formato corto.",
  },
  {
    key: "modality",
    label: "Modalidad",
    description: "Modalidad académica.",
  },
  {
    key: "plan",
    label: "Plan",
    description: "Plan de estudios o versión del programa.",
  },
  {
    key: "enrollment_type",
    label: "Tipo",
    description: "Tipo de inscripción.",
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
    description: "Cómo se explicará la beca dentro del mensaje.",
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
    description: "Beneficio complementario listo para conversación.",
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
    description: "Cargo académico agregado si existe.",
  },
  {
    key: "subtotal",
    label: "Colegiatura mensual",
    description: "Subtotal mensual después de beca y beneficio adicional.",
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
    description: "Llamado a la acción listo para enviar.",
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

type TemplateRecord = Prisma.WhatsappTemplateGetPayload<{
  select: {
    id: true;
    systemKey: true;
    name: true;
    kind: true;
    status: true;
    isDefaultOfficial: true;
    baseText: true;
    fieldOrder: true;
    sourceTemplateId: true;
    ownerUserId: true;
    authorUserId: true;
    reviewNotes: true;
    reviewedByEmail: true;
    submittedAt: true;
    reviewedAt: true;
  };
}>;

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

type SystemWhatsappTemplateSeed = {
  systemKey: string;
  name: string;
  kind: WhatsappTemplateKind;
  baseText: string;
};

const DEFAULT_OFFICIAL_SYSTEM_TEMPLATE_KEY = "official-first-contact-detailed";

const SYSTEM_TEMPLATE_SEEDS: readonly SystemWhatsappTemplateSeed[] = [
  {
    systemKey: "official-first-contact-summary",
    name: "Primer contacto / Resumen",
    kind: WhatsappTemplateKind.summary,
    baseText: `¡Hola! 🎓 Ya tengo tu cotización lista.

🏫 {{1}}
📚 {{2}}
👤 {{6}}

💰 Precio lista: {{8}}
🎁 Beca: {{9}}
✅ *Total: {{18}}*

¿Te explico cómo seguir con tu inscripción?`,
  },
  {
    systemKey: DEFAULT_OFFICIAL_SYSTEM_TEMPLATE_KEY,
    name: "Primer contacto / Detallado",
    kind: WhatsappTemplateKind.detailed,
    baseText: `¡Con esos datos ya tenemos tu estimado listo! 👇

📍 {{1}}
🎓 {{2}}
📘 {{4}} — Plan {{5}}
👤 {{6}}

💲 Precio lista: {{8}}
🏷️ Beca: {{9}}
✅ *Total a pagar: {{18}}*

{{19}}

¿Quieres que revisemos juntos los pasos para continuar?`,
  },
  {
    systemKey: "official-follow-up-summary",
    name: "Seguimiento / Resumen",
    kind: WhatsappTemplateKind.summary,
    baseText: `¡Hola! Solo quería confirmar que recibiste tu cotización 😊

📚 {{2}} — {{4}}
🎁 Beca aplicada: {{9}}
✅ *Total: {{18}}*

¿Tienes alguna duda o quieres avanzar con tu inscripción?`,
  },
  {
    systemKey: "official-follow-up-detailed",
    name: "Seguimiento / Detallado",
    kind: WhatsappTemplateKind.detailed,
    baseText: `Hola, ¿cómo estás? Te comparto tu cotización por si tienes dudas 📋

🏫 {{1}}
🎓 {{2}}
📘 {{4}} — Plan {{5}}

💲 Precio lista: {{8}}
🎁 Beca: {{9}}
💡 Beneficio adicional: {{12}}
✅ *Total: {{18}}*

Cualquier pregunta, aquí estoy 🙌`,
  },
  {
    systemKey: "official-closing-summary",
    name: "Cierre / Resumen",
    kind: WhatsappTemplateKind.summary,
    baseText: `¡Es un gran momento para inscribirte! 🎉

🎓 {{2}}
✅ *Total: {{18}}*

¿Arrancamos con el proceso hoy?`,
  },
  {
    systemKey: "official-closing-detailed",
    name: "Cierre / Detallado",
    kind: WhatsappTemplateKind.detailed,
    baseText: `¡Todo listo para tu inscripción! Aquí el resumen final 🎓

📍 {{1}}
🎓 {{2}} — {{4}}
📝 Plan {{5}} | {{6}}

💲 Lista: {{8}}
🏷️ Beca: {{9}}
💡 Ben. adicional: {{12}}
✅ *Total: {{18}}*

{{19}}

¿Empezamos con los documentos hoy?`,
  },
] as const;

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

const SAMPLE_PREVIEW_DATA: WhatsappTemplatePreviewData = {
  campusLabel: "Plantel ejemplo",
  programLabel: "Licenciatura ejemplo",
  businessLineLabel: "Licenciatura",
  modalityLabel: "Presencial",
  planLabel: "Plan 4",
  enrollmentTypeLabel: "Nuevo ingreso",
  scheduleLabel: "Vespertino",
  listPrice: 5400,
  scholarshipText: "35% (-$1,890.00)",
  scholarshipPercentText: "35%",
  scholarshipAmountText: "-$1,890.00",
  additionalBenefitText: "10% (-$540.00)",
  additionalBenefitPercentText: "10%",
  additionalBenefitAmountText: "-$540.00",
  firstPaymentText: "$1,650.00",
  additionalChargeText: "Examen de admisión $350.00",
  subtotal: 2970,
  total: 3320,
  notes: "Monto estimado sujeto a validación documental.",
  callToAction: "Si quieres, te ayudo a revisar inscripción, documentos y siguiente paso.",
};

function orderTemplates(
  left: SerializableWhatsappTemplate,
  right: SerializableWhatsappTemplate,
) {
  if (left.isOfficial !== right.isOfficial) return left.isOfficial ? -1 : 1;
  if (left.isDefaultOfficial !== right.isDefaultOfficial) {
    return left.isDefaultOfficial ? -1 : 1;
  }
  if (left.status !== right.status) {
    return left.status.localeCompare(right.status, "es");
  }
  return left.name.localeCompare(right.name, "es");
}

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
    campus: compactInlineText(data.campusLabel) || "—",
    program: compactInlineText(data.programLabel) || "—",
    business_line: compactInlineText(data.businessLineLabel) || "—",
    modality: compactInlineText(data.modalityLabel) || "—",
    plan: compactInlineText(data.planLabel) || "—",
    enrollment_type: compactInlineText(data.enrollmentTypeLabel) || "—",
    schedule: compactInlineText(data.scheduleLabel) || "—",
    list_price: formatMoney(data.listPrice),
    scholarship: compactInlineText(data.scholarshipText) || "—",
    scholarship_percent: compactInlineText(data.scholarshipPercentText) || "—",
    scholarship_amount: compactInlineText(data.scholarshipAmountText) || "—",
    additional_benefit: compactInlineText(data.additionalBenefitText) || "—",
    additional_benefit_percent:
      compactInlineText(data.additionalBenefitPercentText) || "—",
    additional_benefit_amount:
      compactInlineText(data.additionalBenefitAmountText) || "—",
    first_payment: compactInlineText(data.firstPaymentText) || "—",
    additional_charge: compactInlineText(data.additionalChargeText) || "—",
    subtotal: formatMoney(data.subtotal),
    total: formatMoney(data.total),
    notes: compactInlineText(data.notes) || "—",
    call_to_action: compactInlineText(data.callToAction) || "—",
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
      if (!Number.isInteger(position) || position < 1 || position > WHATSAPP_TEMPLATE_FIELDS.length) {
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
      if (!fieldKey) return "—";
      embeddedFieldKeys.add(fieldKey);
      return params.previewValues[fieldKey];
    },
  );

  return {
    renderedBaseText,
    embeddedFieldKeys,
  };
}

export function buildWhatsappTemplatePreview(template: {
  baseText?: string | null;
  fieldOrder?: unknown;
}, previewData: WhatsappTemplatePreviewData) {
  const data = {
    ...EMPTY_PREVIEW_DATA,
    ...previewData,
  };

  const previewValues = buildPreviewValueMap(data);
  const fieldLines: Record<WhatsappTemplateFieldKey, string> = {
    campus: `Plantel: ${previewValues.campus}`,
    program: `Programa: ${previewValues.program}`,
    business_line: `Línea: ${previewValues.business_line}`,
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

export function getWhatsappTemplatePreviewSample(
  template: Pick<SerializableWhatsappTemplate, "baseText" | "fieldOrder">,
) {
  return buildWhatsappTemplatePreview(template, SAMPLE_PREVIEW_DATA);
}

export function getFallbackWhatsappTemplateCollection(): WhatsappTemplateCollection {
  const templates: SerializableWhatsappTemplate[] = SYSTEM_TEMPLATE_SEEDS.map((seed) => ({
    id: seed.systemKey,
    systemKey: seed.systemKey,
    name: seed.name,
    kind: seed.kind,
    status: WhatsappTemplateStatus.official,
    isDefaultOfficial: seed.systemKey === DEFAULT_OFFICIAL_SYSTEM_TEMPLATE_KEY,
    baseText: normalizeWhatsappTemplateBaseText(seed.baseText),
    fieldOrder: deriveWhatsappTemplateFieldOrder(seed.baseText),
    sourceTemplateId: null,
    ownerUserId: null,
    authorUserId: null,
    reviewNotes: null,
    reviewedByEmail: null,
    submittedAt: null,
    reviewedAt: null,
    isOfficial: true,
    canEdit: false,
    canDelete: false,
    canSubmitForReview: false,
  }));
  const defaultOfficialTemplateId =
    templates.find((template) => template.isDefaultOfficial)?.id ?? null;
  return {
    templates,
    activeTemplateId: defaultOfficialTemplateId,
    defaultOfficialTemplateId,
  };
}

function canEditTemplate(userId: string, template: TemplateRecord) {
  return (
    template.ownerUserId === userId &&
    (template.status === WhatsappTemplateStatus.personal ||
      template.status === WhatsappTemplateStatus.rejected)
  );
}

function canDeleteTemplate(userId: string, template: TemplateRecord) {
  return canEditTemplate(userId, template);
}

function canSubmitTemplate(userId: string, template: TemplateRecord) {
  return canEditTemplate(userId, template);
}

function serializeTemplate(
  userId: string,
  template: TemplateRecord,
): SerializableWhatsappTemplate {
  return {
    id: template.id,
    systemKey: template.systemKey,
    name: template.name,
    kind: template.kind,
    status: template.status,
    isDefaultOfficial: template.isDefaultOfficial,
    baseText: template.baseText,
    fieldOrder: deriveWhatsappTemplateFieldOrder(template.baseText, template.fieldOrder),
    sourceTemplateId: template.sourceTemplateId,
    ownerUserId: template.ownerUserId,
    authorUserId: template.authorUserId,
    reviewNotes: template.reviewNotes,
    reviewedByEmail: template.reviewedByEmail,
    submittedAt: template.submittedAt?.toISOString() ?? null,
    reviewedAt: template.reviewedAt?.toISOString() ?? null,
    isOfficial: template.status === WhatsappTemplateStatus.official,
    canEdit: canEditTemplate(userId, template),
    canDelete: canDeleteTemplate(userId, template),
    canSubmitForReview: canSubmitTemplate(userId, template),
  };
}

export async function ensureSystemWhatsappTemplates() {
  await prisma.whatsappTemplate.updateMany({
    where: {
      systemKey: { not: null },
      status: { not: WhatsappTemplateStatus.archived },
    },
    data: {
      status: WhatsappTemplateStatus.archived,
      isDefaultOfficial: false,
    },
  });

  return { templates: [] as TemplateRecord[] };
}

export async function listWhatsappTemplatesForUser(
  userId: string,
): Promise<WhatsappTemplateCollection> {
  await ensureSystemWhatsappTemplates();

  const [templates, preference] = await Promise.all([
    prisma.whatsappTemplate.findMany({
      where: {
        systemKey: null,
        status: { not: WhatsappTemplateStatus.archived },
        OR: [
          { status: WhatsappTemplateStatus.official },
          { ownerUserId: userId },
        ],
      },
      orderBy: [
        { status: "asc" },
        { isDefaultOfficial: "desc" },
        { updatedAt: "desc" },
      ],
      select: {
        id: true,
        systemKey: true,
        name: true,
        kind: true,
        status: true,
        isDefaultOfficial: true,
        baseText: true,
        fieldOrder: true,
        sourceTemplateId: true,
        ownerUserId: true,
        authorUserId: true,
        reviewNotes: true,
        reviewedByEmail: true,
        submittedAt: true,
        reviewedAt: true,
      },
    }),
    prisma.whatsappTemplatePreference.findUnique({
      where: { userId },
      select: { activeTemplateId: true },
    }),
  ]);

  const serialized = templates
    .map((template) => serializeTemplate(userId, template))
    .sort(orderTemplates);

  const defaultOfficialTemplateId =
    serialized.find((template) => template.isOfficial && template.isDefaultOfficial)?.id ??
    serialized.find((template) => template.isOfficial)?.id ??
    null;

  const activeTemplateId =
    serialized.some((template) => template.id === preference?.activeTemplateId)
      ? (preference?.activeTemplateId ?? null)
      : defaultOfficialTemplateId;

  return {
    templates: serialized,
    activeTemplateId,
    defaultOfficialTemplateId,
  };
}

export async function createPersonalWhatsappTemplate(params: {
  userId: string;
  name: string;
  kind: WhatsappTemplateKind;
  baseText?: string | null;
  compatibilityFieldOrder?: unknown;
}) {
  validateWhatsappTemplateBaseText(params.baseText);
  const normalizedBaseText = normalizeWhatsappTemplateBaseText(params.baseText);
  const normalizedFieldOrder = deriveWhatsappTemplateFieldOrder(
    normalizedBaseText,
    params.compatibilityFieldOrder,
  );

  const template = await prisma.whatsappTemplate.create({
    data: {
      name: params.name,
      kind: params.kind,
      status: WhatsappTemplateStatus.personal,
      ownerUserId: params.userId,
      authorUserId: params.userId,
      baseText: normalizedBaseText,
      fieldOrder: normalizedFieldOrder as Prisma.InputJsonValue,
    },
  });

  await prisma.whatsappTemplatePreference.upsert({
    where: { userId: params.userId },
    update: { activeTemplateId: template.id },
    create: {
      userId: params.userId,
      activeTemplateId: template.id,
    },
  });

  return template.id;
}

export async function duplicateOfficialWhatsappTemplate(params: {
  userId: string;
  sourceTemplateId: string;
}) {
  const source = await prisma.whatsappTemplate.findFirst({
    where: {
      id: params.sourceTemplateId,
      status: WhatsappTemplateStatus.official,
      systemKey: null,
    },
    select: {
      id: true,
      name: true,
      kind: true,
      baseText: true,
      fieldOrder: true,
    },
  });

  if (!source) {
    throw new Error("official_template_not_found");
  }

  const duplicateName = `${source.name} · Personal`;
  return createPersonalWhatsappTemplate({
    userId: params.userId,
    name: duplicateName,
    kind: source.kind,
    baseText: source.baseText,
    compatibilityFieldOrder: source.fieldOrder,
  });
}

export async function updatePersonalWhatsappTemplate(params: {
  userId: string;
  templateId: string;
  name: string;
  kind: WhatsappTemplateKind;
  baseText?: string | null;
}) {
  const template = await prisma.whatsappTemplate.findUnique({
    where: { id: params.templateId },
    select: {
      id: true,
      ownerUserId: true,
      status: true,
      fieldOrder: true,
    },
  });

  if (!template || !template.ownerUserId || template.ownerUserId !== params.userId) {
    throw new Error("template_not_found");
  }

  if (
    template.status !== WhatsappTemplateStatus.personal &&
    template.status !== WhatsappTemplateStatus.rejected
  ) {
    throw new Error("template_not_editable");
  }

  validateWhatsappTemplateBaseText(params.baseText);
  const normalizedBaseText = normalizeWhatsappTemplateBaseText(params.baseText);
  const normalizedFieldOrder = deriveWhatsappTemplateFieldOrder(
    normalizedBaseText,
    template.fieldOrder,
  );

  await prisma.whatsappTemplate.update({
    where: { id: params.templateId },
    data: {
      name: params.name,
      kind: params.kind,
      baseText: normalizedBaseText,
      fieldOrder: normalizedFieldOrder as Prisma.InputJsonValue,
      status: WhatsappTemplateStatus.personal,
      reviewNotes: null,
      submittedAt: null,
      reviewedAt: null,
      reviewedByEmail: null,
      reviewedByUserId: null,
    },
  });
}

export async function deletePersonalWhatsappTemplate(params: {
  userId: string;
  templateId: string;
}) {
  const template = await prisma.whatsappTemplate.findUnique({
    where: { id: params.templateId },
    select: {
      id: true,
      ownerUserId: true,
      status: true,
    },
  });

  if (!template || !canDeleteTemplate(params.userId, template as TemplateRecord)) {
    throw new Error("template_not_deletable");
  }

  await prisma.$transaction([
    prisma.whatsappTemplatePreference.updateMany({
      where: {
        userId: params.userId,
        activeTemplateId: params.templateId,
      },
      data: {
        activeTemplateId: null,
      },
    }),
    prisma.whatsappTemplate.delete({
      where: { id: params.templateId },
    }),
  ]);
}

export async function setActiveWhatsappTemplate(params: {
  userId: string;
  templateId: string;
}) {
  await ensureSystemWhatsappTemplates();

  const template = await prisma.whatsappTemplate.findFirst({
    where: {
      id: params.templateId,
      status: {
        in: [
          WhatsappTemplateStatus.personal,
          WhatsappTemplateStatus.submitted_for_review,
          WhatsappTemplateStatus.approved,
          WhatsappTemplateStatus.rejected,
          WhatsappTemplateStatus.official,
        ],
      },
      systemKey: null,
      OR: [
        { status: WhatsappTemplateStatus.official },
        { ownerUserId: params.userId },
      ],
    },
    select: { id: true },
  });

  if (!template) {
    throw new Error("template_not_available");
  }

  await prisma.whatsappTemplatePreference.upsert({
    where: { userId: params.userId },
    update: { activeTemplateId: template.id },
    create: {
      userId: params.userId,
      activeTemplateId: template.id,
    },
  });
}

export async function submitWhatsappTemplateForReview(params: {
  userId: string;
  templateId: string;
}) {
  const template = await prisma.whatsappTemplate.findUnique({
    where: { id: params.templateId },
    select: {
      id: true,
      ownerUserId: true,
      status: true,
    },
  });

  if (!template || !canSubmitTemplate(params.userId, template as TemplateRecord)) {
    throw new Error("template_not_submittable");
  }

  await prisma.whatsappTemplate.update({
    where: { id: params.templateId },
    data: {
      status: WhatsappTemplateStatus.submitted_for_review,
      submittedAt: new Date(),
    },
  });
}

export async function listSubmittedWhatsappTemplatesForAdmin(): Promise<
  AdminWhatsappTemplateQueueItem[]
> {
  await ensureSystemWhatsappTemplates();

  const templates = await prisma.whatsappTemplate.findMany({
    where: {
      systemKey: null,
      status: {
        in: [
          WhatsappTemplateStatus.submitted_for_review,
          WhatsappTemplateStatus.approved,
        ],
      },
      ownerUserId: { not: null },
    },
    orderBy: [
      { submittedAt: "desc" },
      { updatedAt: "desc" },
    ],
    select: {
      id: true,
      systemKey: true,
      name: true,
      kind: true,
      status: true,
      isDefaultOfficial: true,
      baseText: true,
      fieldOrder: true,
      sourceTemplateId: true,
      ownerUserId: true,
      authorUserId: true,
      reviewNotes: true,
      reviewedByEmail: true,
      submittedAt: true,
      reviewedAt: true,
      owner: {
        select: { email: true },
      },
      author: {
        select: { email: true },
      },
    },
  });

  return templates.map((template) => {
    const serialized = serializeTemplate(template.ownerUserId ?? "", {
      id: template.id,
      systemKey: template.systemKey,
      name: template.name,
      kind: template.kind,
      status: template.status,
      isDefaultOfficial: template.isDefaultOfficial,
      baseText: template.baseText,
      fieldOrder: template.fieldOrder,
      sourceTemplateId: template.sourceTemplateId,
      ownerUserId: template.ownerUserId,
      authorUserId: template.authorUserId,
      reviewNotes: template.reviewNotes,
      reviewedByEmail: template.reviewedByEmail,
      submittedAt: template.submittedAt,
      reviewedAt: template.reviewedAt,
    });

    return {
      ...serialized,
      ownerEmail: template.owner?.email ?? null,
      authorEmail: template.author?.email ?? template.owner?.email ?? null,
      preview: getWhatsappTemplatePreviewSample(serialized),
    };
  });
}

export async function listOfficialWhatsappTemplatesForAdmin(): Promise<
  AdminOfficialWhatsappTemplateItem[]
> {
  await ensureSystemWhatsappTemplates();

  const templates = await prisma.whatsappTemplate.findMany({
    where: {
      status: WhatsappTemplateStatus.official,
      systemKey: null,
    },
    orderBy: [{ isDefaultOfficial: "desc" }, { updatedAt: "desc" }],
    select: {
      id: true,
      systemKey: true,
      name: true,
      kind: true,
      status: true,
      isDefaultOfficial: true,
      baseText: true,
      fieldOrder: true,
      sourceTemplateId: true,
      ownerUserId: true,
      authorUserId: true,
      reviewNotes: true,
      reviewedByEmail: true,
      submittedAt: true,
      reviewedAt: true,
    },
  });

  return templates.map((template) => {
    const serialized = serializeTemplate("admin", template);
    return {
      ...serialized,
      preview: getWhatsappTemplatePreviewSample(serialized),
    };
  });
}

export async function upsertOfficialWhatsappTemplateAsAdmin(params: {
  templateId?: string | null;
  adminUserId: string;
  adminEmail: string;
  name: string;
  kind: WhatsappTemplateKind;
  baseText?: string | null;
  setAsDefault?: boolean;
}) {
  const name = compactInlineText(params.name).slice(0, 80);
  if (!name) {
    throw new Error("invalid_template_name");
  }

  const now = new Date();

  if (params.templateId) {
    const existing = await prisma.whatsappTemplate.findUnique({
      where: { id: params.templateId },
      select: {
        id: true,
        status: true,
        kind: true,
        systemKey: true,
        isDefaultOfficial: true,
        authorUserId: true,
        fieldOrder: true,
      },
    });

    if (!existing || existing.status !== WhatsappTemplateStatus.official) {
      throw new Error("official_template_not_found");
    }

    const effectiveKind = existing.systemKey ? existing.kind : params.kind;
    validateWhatsappTemplateBaseText(params.baseText);
    const normalizedBaseText = normalizeWhatsappTemplateBaseText(params.baseText);
    const normalizedFieldOrder = deriveWhatsappTemplateFieldOrder(
      normalizedBaseText,
      existing.fieldOrder,
    );

    await prisma.$transaction(async (tx) => {
      if (params.setAsDefault) {
        await tx.whatsappTemplate.updateMany({
          where: {
            status: WhatsappTemplateStatus.official,
            isDefaultOfficial: true,
          },
          data: { isDefaultOfficial: false },
        });
      }

      await tx.whatsappTemplate.update({
        where: { id: existing.id },
        data: {
          name,
          kind: effectiveKind,
          baseText: normalizedBaseText,
          fieldOrder: normalizedFieldOrder as Prisma.InputJsonValue,
          isDefaultOfficial: params.setAsDefault ? true : existing.isDefaultOfficial,
          reviewedAt: now,
          reviewedByUserId: params.adminUserId,
          reviewedByEmail: params.adminEmail,
          authorUserId: existing.authorUserId ?? params.adminUserId,
          ownerUserId: null,
          status: WhatsappTemplateStatus.official,
        },
      });
    });

    return existing.id;
  }

  validateWhatsappTemplateBaseText(params.baseText);
  const normalizedBaseText = normalizeWhatsappTemplateBaseText(params.baseText);
  const normalizedFieldOrder = deriveWhatsappTemplateFieldOrder(normalizedBaseText);

  return prisma.$transaction(async (tx) => {
    if (params.setAsDefault) {
      await tx.whatsappTemplate.updateMany({
        where: {
          status: WhatsappTemplateStatus.official,
          isDefaultOfficial: true,
        },
        data: { isDefaultOfficial: false },
      });
    }

    const created = await tx.whatsappTemplate.create({
      data: {
        name,
        kind: params.kind,
        status: WhatsappTemplateStatus.official,
        ownerUserId: null,
        authorUserId: params.adminUserId,
        isDefaultOfficial: Boolean(params.setAsDefault),
        baseText: normalizedBaseText,
        fieldOrder: normalizedFieldOrder as Prisma.InputJsonValue,
        reviewedAt: now,
        reviewedByUserId: params.adminUserId,
        reviewedByEmail: params.adminEmail,
      },
      select: { id: true },
    });

    return created.id;
  });
}

export async function reviewWhatsappTemplateAsAdmin(params: {
  templateId: string;
  decision: "approve" | "reject" | "publish";
  adminUserId: string;
  adminEmail: string;
  reviewNotes?: string | null;
}) {
  const source = await prisma.whatsappTemplate.findUnique({
    where: { id: params.templateId },
    select: {
      id: true,
      name: true,
      kind: true,
      status: true,
      ownerUserId: true,
      authorUserId: true,
      baseText: true,
      fieldOrder: true,
    },
  });

  if (!source || !source.ownerUserId) {
    throw new Error("template_not_found");
  }

  if (
    source.status !== WhatsappTemplateStatus.submitted_for_review &&
    source.status !== WhatsappTemplateStatus.approved
  ) {
    throw new Error("template_not_in_review");
  }

  const reviewNotes = compactInlineText(params.reviewNotes) || null;
  const now = new Date();

  if (params.decision === "reject") {
    await prisma.whatsappTemplate.update({
      where: { id: source.id },
      data: {
        status: WhatsappTemplateStatus.rejected,
        reviewNotes,
        reviewedAt: now,
        reviewedByUserId: params.adminUserId,
        reviewedByEmail: params.adminEmail,
      },
    });
    return;
  }

  if (params.decision === "approve") {
    await prisma.whatsappTemplate.update({
      where: { id: source.id },
      data: {
        status: WhatsappTemplateStatus.approved,
        reviewNotes,
        reviewedAt: now,
        reviewedByUserId: params.adminUserId,
        reviewedByEmail: params.adminEmail,
      },
    });
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.whatsappTemplate.update({
      where: { id: source.id },
      data: {
        status: WhatsappTemplateStatus.approved,
        reviewNotes,
        reviewedAt: now,
        reviewedByUserId: params.adminUserId,
        reviewedByEmail: params.adminEmail,
      },
    });

    await tx.whatsappTemplate.create({
      data: {
        name: source.name,
        kind: source.kind,
        status: WhatsappTemplateStatus.official,
        ownerUserId: null,
        authorUserId: source.authorUserId ?? source.ownerUserId,
        sourceTemplateId: source.id,
        isDefaultOfficial: false,
        baseText: source.baseText,
        fieldOrder: deriveWhatsappTemplateFieldOrder(
          source.baseText,
          source.fieldOrder,
        ) as Prisma.InputJsonValue,
        reviewNotes,
        reviewedAt: now,
        reviewedByUserId: params.adminUserId,
        reviewedByEmail: params.adminEmail,
      },
    });
  });
}
