export type ProspectTrackingSheetKey =
  | "seguimiento"
  | "campanas"
  | "contactos"
  | "metadatos";

export type ProspectTrackingSheetName =
  | "Campañas"
  | "Seguimiento"
  | "Contactos"
  | "Metadatos";

export type ProspectTrackingSheetDefinition = {
  key: ProspectTrackingSheetKey;
  label: string;
  sheetName: ProspectTrackingSheetName;
  gid: string;
  rowsLabel: string;
  description: string;
  columns: string[];
};

export type ProspectSheetValue = string | number | boolean | null;

export type ProspectContactSyncRow = {
  id: string;
  contactName: string;
  phone: string;
  normalizedPhone: string;
  email: string | null;
  tags: string[];
  personalData: string | null;
  notes: string | null;
  lastWhatsappMessageAt: string | null;
  lastWhatsappMessageText: string | null;
  campaignMessageCount: number;
  assignedQuoteSessionPublicId: string | null;
  assignedScenarioId: string | null;
  source: string;
  updatedAt: string;
};

export type ProspectCampaignRecipientSyncRow = {
  contactValue: string;
  contactName: string | null;
  status: string;
  updatedAt: string;
};

export type ProspectCampaignSyncRow = {
  id: string;
  campaignName: string;
  channel: string;
  status: string;
  scheduleAt: string | null;
  batchSize: number;
  messageDelayMs: number;
  messageTemplate: string | null;
  notes: string | null;
  updatedAt: string;
  recipients: ProspectCampaignRecipientSyncRow[];
};

export type ProspectGeneratedSheet = {
  name: ProspectTrackingSheetName;
  values: ProspectSheetValue[][];
  clearRange: string;
  frozenRowCount: number;
  minRowCount: number;
  columnCount: number;
  columnWidths: number[];
  headerRowIndexes: number[];
};

export const PROSPECT_TRACKING_SHEETS = [
  {
    key: "seguimiento",
    label: "Seguimiento",
    sheetName: "Seguimiento",
    gid: "1630061474",
    rowsLabel: "Bitacora por usuario",
    description:
      "Bitacora de toques, tipificacion, clasificacion, motivo, resolucion y estado por canal.",
    columns: ["Toque", "Clasificacion", "Motivo", "Resolucion", "WhatsApp", "Correo", "Llamada"],
  },
  {
    key: "campanas",
    label: "Campañas",
    sheetName: "Campañas",
    gid: "1854268015",
    rowsLabel: "Campanas del usuario",
    description:
      "Resumen operativo por campana: canal, batch, estado, enviados, fallidos y fechas.",
    columns: ["Campana", "Canal", "Estado", "Batch", "Enviados", "Fallidos", "Runner"],
  },
  {
    key: "contactos",
    label: "Contactos",
    sheetName: "Contactos",
    gid: "1142934270",
    rowsLabel: "Contactos propios",
    description:
      "Directorio deduplicado con datos de contacto, plantel, plan, expediente y origen.",
    columns: ["Nombre", "Telefono", "Correo", "Plantel", "Plan", "Expediente", "Fuente"],
  },
  {
    key: "metadatos",
    label: "Metadatos",
    sheetName: "Metadatos",
    gid: "746858452",
    rowsLabel: "Catalogos y reglas",
    description:
      "Diccionario de campos, origenes, valores recomendados y reglas para mantener consistencia.",
    columns: ["Campo", "Hoja", "Tipo", "Valores", "Uso", "Notas"],
  },
] as const satisfies readonly ProspectTrackingSheetDefinition[];

export const PROSPECT_TRACKING_WORKBOOK_SHEET_NAMES = [
  "Campañas",
  "Seguimiento",
  "Contactos",
  "Metadatos",
] as const satisfies readonly ProspectTrackingSheetName[];

export const GOOGLE_CONTACTS_SHEET_NAME = "Contactos";
export const PROSPECT_TRACKING_SPREADSHEET_TITLE = "Seguimiento de prospectos ReLead";

const HEADER_FILL_HEX = "#0f5672";

export const PROSPECT_TRACKING_HEADER_STYLE = {
  backgroundColor: HEADER_FILL_HEX,
  foregroundColor: "#ffffff",
  bold: true,
};

const CAMPANAS_HEADERS = [
  "campaign_id",
  "nombre_campaña",
  "canal",
  "estado",
  "fecha_programada",
  "batch_size",
  "delay_seg",
  "total_destinatarios",
  "enviados",
  "fallidos",
  "pendientes",
  "tasa_envio",
  "tasa_fallo",
  "template",
  "notas",
  "actualizado_en",
  "fuente",
] as const;

const SEGUIMIENTO_HEADERS = [
  "seguimiento_id",
  "contact_key",
  "expediente",
  "nombre",
  "telefono",
  "correo",
  "linea",
  "programa",
  "plantel",
  "toque",
  "whatsapp_estado",
  "correo_estado",
  "llamada_estado",
  "sms_estado",
  "clasificacion",
  "motivo",
  "resolucion",
  "prioridad",
  "siguiente_accion",
  "propietario",
  "campaign_id",
  "notas",
  "actualizado_en",
  "fuente",
] as const;

const CONTACTOS_HEADERS = [
  "contact_key",
  "nombre",
  "telefono_normalizado",
  "telefono_original",
  "correo",
  "expediente",
  "linea",
  "programa",
  "plantel",
  "estado_contactabilidad",
  "ultima_clasificacion",
  "ultimo_motivo",
  "ultima_resolucion",
  "toques",
  "ultima_fuente",
  "notas",
] as const;

const TRACKING_COLUMNS = {
  Campañas: CAMPANAS_HEADERS.length,
  Seguimiento: SEGUIMIENTO_HEADERS.length,
  Contactos: CONTACTOS_HEADERS.length,
  Metadatos: 7,
} as const;

const COLUMN_WIDTHS = {
  Campañas: [
    243, 171, 103, 63, 112, 64, 61, 113, 56, 46, 68, 78, 98, 1296, 394, 90, 124,
  ],
  Seguimiento: [
    92, 77, 69, 417, 81, 273, 87, 455, 106, 38, 106, 86, 96, 78, 129, 139, 166, 57, 150,
    189, 126, 36, 90, 182,
  ],
  Contactos: [77, 417, 131, 102, 273, 69, 87, 455, 106, 138, 129, 139, 166, 43, 182, 36],
  Metadatos: [639, 513, 812, 65, 209, 257, 168],
} as const;

function normalizePhoneKey(value: string | null | undefined) {
  return String(value ?? "").replace(/\D+/g, "").trim();
}

function normalizeText(value: string | null | undefined) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function formatDelaySeconds(messageDelayMs: number) {
  if (!Number.isFinite(messageDelayMs) || messageDelayMs <= 0) return "";
  return Math.round(messageDelayMs / 1000);
}

function isSentStatus(status: string) {
  const normalized = status.trim().toLowerCase();
  return normalized === "sent" || normalized === "delivered" || normalized === "read";
}

function isFailedStatus(status: string) {
  const normalized = status.trim().toLowerCase();
  return normalized === "failed" || normalized === "error" || normalized === "blocked";
}

function buildCampaignRows(campaigns: ProspectCampaignSyncRow[]) {
  return campaigns.map((campaign) => {
    const total = campaign.recipients.length;
    const sent = campaign.recipients.filter((recipient) => isSentStatus(recipient.status)).length;
    const failed = campaign.recipients.filter((recipient) => isFailedStatus(recipient.status)).length;
    const pending = Math.max(total - sent - failed, 0);

    return [
      campaign.id,
      campaign.campaignName,
      campaign.channel,
      campaign.status,
      campaign.scheduleAt ?? "",
      campaign.batchSize,
      formatDelaySeconds(campaign.messageDelayMs),
      total,
      sent,
      failed,
      pending,
      total ? sent / total : 0,
      total ? failed / total : 0,
      campaign.messageTemplate ?? "",
      campaign.notes ?? "",
      campaign.updatedAt,
      "App ReCalc",
    ];
  });
}

function buildLatestCampaignByPhone(campaigns: ProspectCampaignSyncRow[]) {
  const rows = new Map<string, { campaignId: string; recipientStatus: string; updatedAt: string }>();

  for (const campaign of campaigns) {
    for (const recipient of campaign.recipients) {
      const key = normalizePhoneKey(recipient.contactValue);
      if (!key) continue;

      const existing = rows.get(key);
      if (!existing || recipient.updatedAt > existing.updatedAt) {
        rows.set(key, {
          campaignId: campaign.id,
          recipientStatus: recipient.status,
          updatedAt: recipient.updatedAt,
        });
      }
    }
  }

  return rows;
}

function buildContactKey(contact: ProspectContactSyncRow) {
  return normalizePhoneKey(contact.normalizedPhone) || normalizePhoneKey(contact.phone) || contact.id;
}

function buildContactability(contact: ProspectContactSyncRow) {
  if (!buildContactKey(contact)) return "Por validar";
  if (contact.lastWhatsappMessageAt || contact.campaignMessageCount > 0) return "Contactable";
  return "Por validar";
}

function buildSeguimientoRows(params: {
  contacts: ProspectContactSyncRow[];
  campaigns: ProspectCampaignSyncRow[];
  ownerEmail: string | null;
}) {
  const latestCampaignByPhone = buildLatestCampaignByPhone(params.campaigns);

  return params.contacts.map((contact, index) => {
    const contactKey = buildContactKey(contact);
    const campaign = latestCampaignByPhone.get(contactKey);
    const hasWhatsappContact = Boolean(contact.lastWhatsappMessageAt) || campaign?.recipientStatus === "sent";

    return [
      `SEG-${String(index + 1).padStart(6, "0")}`,
      contactKey,
      "",
      contact.contactName,
      contact.phone,
      contact.email ?? "",
      "",
      "",
      "",
      contact.campaignMessageCount,
      hasWhatsappContact ? "Con contacto" : "Sin contacto",
      "Sin contacto",
      "Sin contacto",
      "Sin contacto",
      "",
      "",
      "SIN RESOLUCION",
      "",
      "",
      params.ownerEmail ?? "",
      campaign?.campaignId ?? "",
      contact.notes ?? contact.personalData ?? "",
      contact.updatedAt,
      contact.source || "App ReCalc",
    ];
  });
}

function buildContactRows(contacts: ProspectContactSyncRow[]) {
  return contacts.map((contact) => [
    buildContactKey(contact),
    contact.contactName,
    normalizePhoneKey(contact.normalizedPhone) || normalizePhoneKey(contact.phone),
    contact.phone,
    contact.email ?? "",
    "",
    "",
    "",
    "",
    buildContactability(contact),
    "",
    "",
    "SIN RESOLUCION",
    contact.campaignMessageCount,
    contact.source || "App ReCalc",
    contact.notes ?? contact.personalData ?? "",
  ]);
}

function buildMetadataRows(params: {
  contacts: ProspectContactSyncRow[];
  campaigns: ProspectCampaignSyncRow[];
  generatedAt: string;
}) {
  const uniqueContacts = new Set(params.contacts.map(buildContactKey).filter(Boolean)).size;
  return [
    ["Modelo recomendado para seguimiento de prospectos", "", "", "", "", "", ""],
    [
      "ReCalc separa campaña, seguimiento operativo y contacto maestro para evitar mezclar datos crudos con reportes.",
      "",
      "",
      "",
      "",
      "",
      "",
    ],
    ["", "", "", "", "", "", ""],
    ["Métrica", "Valor", "", "", "Campo fuente", "Nueva hoja", "Uso"],
    ["Filas de seguimiento", params.contacts.length, "", "", "LINEA", "Seguimiento.linea / Contactos.linea", "Segmentación académica"],
    ["Contactos únicos", uniqueContacts, "", "", "PLAN ESTUDIO", "Seguimiento.programa / Contactos.programa", "Interés académico"],
    ["Campañas leídas de la app", params.campaigns.length, "", "", "PLANTEL", "Seguimiento.plantel / Contactos.plantel", "Ubicación o modalidad"],
    ["Generado", params.generatedAt, "", "", "EXPEDIENTE", "Contactos.expediente", "Llave académica externa"],
    ["", "", "", "", "NOMBRE COMPLETO", "Contactos.nombre", "Nombre visible del prospecto"],
    ["", "", "", "", "CORREO ELECTRONICO", "Contactos.correo", "Medio de contacto"],
    ["Área", "Actualmente en la app", "Integración recomendada", "", "TELEFONO / FORMATO MASIVOS", "Contactos.telefono_normalizado", "Llave de deduplicación"],
    [
      "Contactos",
      "Nombre, teléfono, correo, etiquetas, notas, último WhatsApp, cotización vinculada",
      "Agregar expediente, línea, programa, plantel, clasificación, motivo y resolución cuando esos campos existan en la fuente maestra.",
      "",
      "TOQUE",
      "Seguimiento.toque",
      "Número de intento",
    ],
    [
      "Campañas",
      "Campaña, canal, estado, batch, template, destinatarios y status por receptor",
      "Exportar hoja Campañas y relacionarla con Seguimiento mediante campaign_id.",
      "",
      "WHATSAPP/CORREO/LLAMADA/SMS",
      "Seguimiento.*_estado",
      "Resultado por canal",
    ],
    [
      "Seguimiento",
      "Se genera desde contactos, campañas y mensajes disponibles del usuario",
      "Completar clasificación, motivo, resolución y siguiente acción desde CRM o hoja maestra cuando se defina el flujo de ownership.",
      "",
      "CLASIFICACION",
      "Seguimiento.clasificacion",
      "Estado comercial principal",
    ],
    [
      "Metadatos",
      "Diccionario visible de campos y recomendaciones",
      "Mantener catálogos para validar importaciones y evitar valores duplicados o ambiguos.",
      "",
      "MOTIVO",
      "Seguimiento.motivo",
      "Razón del estado",
    ],
    ["", "", "", "", "RESOLUCION", "Seguimiento.resolucion", "Cierre o resultado"],
  ];
}

function sheetConfig(
  name: ProspectTrackingSheetName,
  values: ProspectSheetValue[][],
  options: {
    frozenRowCount: number;
    minRowCount: number;
    headerRowIndexes?: number[];
  },
): ProspectGeneratedSheet {
  const columnCount = TRACKING_COLUMNS[name];
  return {
    name,
    values,
    clearRange: `${name}!A:Z`,
    frozenRowCount: options.frozenRowCount,
    minRowCount: options.minRowCount,
    columnCount,
    columnWidths: [...COLUMN_WIDTHS[name]],
    headerRowIndexes: options.headerRowIndexes ?? [0],
  };
}

export function buildProspectTrackingSheets(params: {
  contacts: ProspectContactSyncRow[];
  campaigns: ProspectCampaignSyncRow[];
  ownerEmail?: string | null;
  generatedAt?: string;
}): ProspectGeneratedSheet[] {
  const generatedAt = params.generatedAt ?? new Date().toISOString();
  const contacts = params.contacts.map((contact) => ({
    ...contact,
    contactName: normalizeText(contact.contactName),
    phone: normalizeText(contact.phone),
    normalizedPhone: normalizeText(contact.normalizedPhone),
    email: contact.email ? normalizeText(contact.email) : null,
    tags: contact.tags.map(normalizeText).filter(Boolean),
    source: normalizeText(contact.source) || "App ReCalc",
  }));
  const campaigns = params.campaigns.map((campaign) => ({
    ...campaign,
    campaignName: normalizeText(campaign.campaignName),
    channel: normalizeText(campaign.channel),
    status: normalizeText(campaign.status),
    recipients: campaign.recipients.map((recipient) => ({
      ...recipient,
      contactValue: normalizeText(recipient.contactValue),
      contactName: recipient.contactName ? normalizeText(recipient.contactName) : null,
      status: normalizeText(recipient.status),
    })),
  }));

  return [
    sheetConfig("Campañas", [[...CAMPANAS_HEADERS], ...buildCampaignRows(campaigns)], {
      frozenRowCount: 25,
      minRowCount: 1000,
    }),
    sheetConfig(
      "Seguimiento",
      [
        [...SEGUIMIENTO_HEADERS],
        ...buildSeguimientoRows({
          contacts,
          campaigns,
          ownerEmail: params.ownerEmail ?? null,
        }),
      ],
      {
        frozenRowCount: 1,
        minRowCount: 4200,
      },
    ),
    sheetConfig("Contactos", [[...CONTACTOS_HEADERS], ...buildContactRows(contacts)], {
      frozenRowCount: 1,
      minRowCount: 3801,
    }),
    sheetConfig(
      "Metadatos",
      buildMetadataRows({ contacts, campaigns, generatedAt }),
      {
        frozenRowCount: 4,
        minRowCount: 46,
        headerRowIndexes: [0, 3, 10],
      },
    ),
  ];
}
