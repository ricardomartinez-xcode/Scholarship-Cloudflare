import { Prisma } from "@prisma/client";

import {
  syncContactsSnapshotToGoogle,
  getAgendaIntegrationStatus,
  GOOGLE_CONTACTS_SHEET_NAME,
} from "@/lib/google-integration";
import { normalizeEmail } from "@/lib/normalize";
import { prisma } from "@/lib/prisma";

export type UserContactInput = {
  contactName: string;
  phone: string;
  waId?: string | null;
  bsuid?: string | null;
  parentBsuid?: string | null;
  whatsappUsername?: string | null;
  profilePictureUrl?: string | null;
  profileSource?: string | null;
  email?: string | null;
  tags?: string[] | string | null;
  personalData?: string | null;
  notes?: string | null;
  assignedQuoteSessionPublicId?: string | null;
  assignedScenarioId?: string | null;
  source?: string | null;
};

export type UserContactImportInput = {
  contactName?: string | null;
  phone: string;
  email?: string | null;
  tags?: string[] | string | null;
  personalData?: string | null;
  notes?: string | null;
  source?: string | null;
};

type UserContactRecord = Prisma.UserContactGetPayload<object>;

type ContactCampaignMembership = {
  campaignId: string;
  campaignName: string;
  status: string;
  scheduleAt: string | null;
  recipientStatus: string;
};

export type MetaIdentityInput = {
  phone?: string | null;
  waId?: string | null;
  bsuid?: string | null;
  parentBsuid?: string | null;
  contactName?: string | null;
  whatsappUsername?: string | null;
  profilePictureUrl?: string | null;
  profileSource?: string | null;
  source?: string | null;
};

function normalizeText(value: string | null | undefined) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeCsvHeader(value: string) {
  return normalizeText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function splitCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"') {
      if (quoted && next === '"') {
        current += '"';
        index += 1;
        continue;
      }

      quoted = !quoted;
      continue;
    }

    if (!quoted && char === ",") {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

const CONTACT_CSV_FIELD_ALIASES: Record<
  keyof UserContactImportInput | "assignedQuoteSessionPublicId" | "assignedScenarioId",
  string[]
> = {
  contactName: [
    "nombre",
    "name",
    "contacto",
    "contact",
    "nombrecompleto",
    "fullname",
    "full_name",
  ],
  phone: [
    "telefono",
    "phone",
    "numero",
    "number",
    "celular",
    "movil",
    "mobile",
    "whatsapp",
  ],
  email: ["correo", "email", "mail"],
  tags: ["etiquetas", "tags", "tag"],
  personalData: [
    "datospersonales",
    "personaldata",
    "datos",
    "contexto",
    "perfil",
  ],
  notes: ["notas", "notes", "seguimiento", "comentarios", "observaciones"],
  source: ["origen", "source"],
  assignedQuoteSessionPublicId: [
    "cotizacion",
    "cotizacionvinculada",
    "sessionpublicid",
    "quotesession",
  ],
  assignedScenarioId: ["escenario", "escenariovinculado", "scenario"],
};

function detectCsvHeaderMap(headerRow: string[]) {
  const normalizedHeaders = headerRow.map((header) => normalizeCsvHeader(header));
  const fieldEntries = Object.entries(CONTACT_CSV_FIELD_ALIASES) as Array<
    [keyof typeof CONTACT_CSV_FIELD_ALIASES, string[]]
  >;
  const mapping = new Map<keyof typeof CONTACT_CSV_FIELD_ALIASES, number>();

  for (const [field, aliases] of fieldEntries) {
    const columnIndex = normalizedHeaders.findIndex((header) => aliases.includes(header));
    if (columnIndex >= 0) {
      mapping.set(field, columnIndex);
    }
  }

  return mapping;
}

function splitTagsFromCsvCell(value: string) {
  return String(value ?? "")
    .split(/[|;,]/)
    .map((item) => normalizeText(item))
    .filter(Boolean);
}

export function normalizeContactPhone(value: string) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return "";

  const hasPlus = normalized.startsWith("+");
  const digits = normalized.replace(/\D+/g, "");
  if (!digits) return "";
  return hasPlus ? `+${digits}` : digits;
}

function normalizeTags(value: string[] | string | null | undefined) {
  const raw = Array.isArray(value)
    ? value
    : String(value ?? "")
        .split(",")
        .map((item) => item.trim());

  const unique = Array.from(
    new Set(
      raw
        .map((item) => normalizeText(item))
        .filter(Boolean)
        .map((item) => item.toLowerCase()),
    ),
  );

  return unique;
}

function normalizeOptionalText(value: string | null | undefined) {
  return normalizeText(value) || null;
}

function normalizeMetaIdentityValue(value: string | null | undefined) {
  return normalizeOptionalText(value);
}

function readTags(value: unknown) {
  if (!Array.isArray(value)) return [] as string[];
  return value
    .map((item) => normalizeText(String(item ?? "")))
    .filter(Boolean);
}

function toInputJson(value: unknown) {
  return value as Prisma.InputJsonValue;
}

function buildScenarioLabel(record: {
  label: string;
  programNameSnapshot?: string | null;
  campusNameSnapshot?: string | null;
}) {
  const label = normalizeText(record.label);
  if (label) return label;
  return [record.programNameSnapshot, record.campusNameSnapshot]
    .map((item) => normalizeText(item))
    .filter(Boolean)
    .join(" · ") || "Escenario";
}

function serializeContact(
  contact: UserContactRecord,
  campaignMemberships: ContactCampaignMembership[] = [],
) {
  return {
    id: contact.id,
    contactName: contact.contactName,
    phone: contact.phone,
    normalizedPhone: contact.normalizedPhone,
    waId: contact.waId,
    bsuid: contact.bsuid,
    parentBsuid: contact.parentBsuid,
    whatsappUsername: contact.whatsappUsername,
    profilePictureUrl: contact.profilePictureUrl,
    profileSource: contact.profileSource,
    lastProfileSyncAt: contact.lastProfileSyncAt?.toISOString() ?? null,
    lastIdentitySyncAt: contact.lastIdentitySyncAt?.toISOString() ?? null,
    email: contact.email,
    tags: readTags(contact.tags),
    personalData: contact.personalData,
    notes: contact.notes,
    lastWhatsappMessageAt: contact.lastWhatsappMessageAt?.toISOString() ?? null,
    lastWhatsappMessageText: contact.lastWhatsappMessageText,
    campaignMessageCount: contact.campaignMessageCount,
    hasWhatsappHistory:
      Boolean(contact.lastWhatsappMessageAt) || contact.campaignMessageCount > 0,
    campaignMemberships,
    activeCampaignCount: campaignMemberships.filter((membership) =>
      [
        "queued",
        "scheduled",
        "running",
        "processing",
        "waiting_runner",
        "paused",
      ].includes(membership.status),
    ).length,
    assignedQuoteSessionPublicId: contact.assignedQuoteSessionPublicId,
    assignedScenarioId: contact.assignedScenarioId,
    source: contact.source,
    sheetSyncedAt: contact.sheetSyncedAt?.toISOString() ?? null,
    createdAt: contact.createdAt.toISOString(),
    updatedAt: contact.updatedAt.toISOString(),
  };
}

async function validateQuoteAssignment(
  userId: string,
  sessionPublicId?: string | null,
  scenarioId?: string | null,
) {
  const normalizedSessionId = normalizeText(sessionPublicId);
  const normalizedScenarioId = normalizeText(scenarioId);

  if (!normalizedSessionId && normalizedScenarioId) {
    throw new Error("Selecciona primero una cotización antes de vincular un escenario.");
  }

  if (!normalizedSessionId) {
    return {
      assignedQuoteSessionPublicId: null,
      assignedScenarioId: null,
    };
  }

  const session = await prisma.quoteSession.findFirst({
    where: {
      ownerUserId: userId,
      publicId: normalizedSessionId,
    },
    select: {
      publicId: true,
      scenarios: {
        select: { id: true },
      },
    },
  });

  if (!session) {
    throw new Error("La cotización seleccionada ya no existe para este usuario.");
  }

  if (
    normalizedScenarioId &&
    !session.scenarios.some((scenario) => scenario.id === normalizedScenarioId)
  ) {
    throw new Error("El escenario seleccionado no pertenece a la cotización indicada.");
  }

  return {
    assignedQuoteSessionPublicId: session.publicId,
    assignedScenarioId: normalizedScenarioId || null,
  };
}

async function buildUserContactData(userId: string, input: UserContactInput) {
  const phone = normalizeText(input.phone);
  const normalizedPhone = normalizeContactPhone(phone);
  if (!normalizedPhone) {
    throw new Error("El teléfono es obligatorio y debe ser válido.");
  }

  const contactName = normalizeText(input.contactName) || normalizedPhone;
  const email = normalizeEmail(input.email ?? null) || null;
  const tags = normalizeTags(input.tags);
  const assignment = await validateQuoteAssignment(
    userId,
    input.assignedQuoteSessionPublicId,
    input.assignedScenarioId,
  );

  return {
    contactName,
    phone,
    normalizedPhone,
    waId: normalizeMetaIdentityValue(input.waId),
    bsuid: normalizeMetaIdentityValue(input.bsuid),
    parentBsuid: normalizeMetaIdentityValue(input.parentBsuid),
    whatsappUsername: normalizeMetaIdentityValue(input.whatsappUsername),
    profilePictureUrl: normalizeMetaIdentityValue(input.profilePictureUrl),
    profileSource: normalizeMetaIdentityValue(input.profileSource),
    lastProfileSyncAt: input.profilePictureUrl || input.whatsappUsername ? new Date() : null,
    lastIdentitySyncAt:
      input.waId || input.bsuid || input.parentBsuid || input.whatsappUsername
        ? new Date()
        : null,
    email,
    tags: tags.length ? toInputJson(tags) : Prisma.JsonNull,
    personalData: normalizeText(input.personalData) || null,
    notes: normalizeText(input.notes) || null,
    source: normalizeText(input.source) || "manual",
    ...assignment,
  };
}

export function parseUserContactsText(value: string) {
  return String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map<UserContactImportInput>((line) => {
      const parts = line
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

      if (parts.length === 1) {
        return { phone: parts[0] };
      }

      if (parts.length === 2) {
        return {
          contactName: parts[0],
          phone: parts[1],
        };
      }

      return {
        contactName: parts[0],
        phone: parts[1],
        email: parts[2],
        tags: parts.slice(3),
      };
    });
}

export function parseUserContactsCsv(value: string) {
  const rows = String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map(splitCsvLine)
    .filter((columns) => columns.some((column) => normalizeText(column)));

  if (!rows.length) return [] as UserContactImportInput[];

  const headerMap = detectCsvHeaderMap(rows[0] ?? []);
  const dataRows =
    headerMap.size > 0 && headerMap.has("phone") ? rows.slice(1) : rows;

  if (!(headerMap.size > 0 && headerMap.has("phone"))) {
    return parseUserContactsText(
      dataRows.map((columns) => columns.join(", ")).join("\n"),
    );
  }

  return dataRows
    .map<UserContactImportInput | null>((columns) => {
      const pick = (field: keyof typeof CONTACT_CSV_FIELD_ALIASES) => {
        const index = headerMap.get(field);
        if (index === undefined) return "";
        return String(columns[index] ?? "").trim();
      };

      const phone = pick("phone");
      if (!phone) return null;

      return {
        contactName: pick("contactName") || null,
        phone,
        email: pick("email") || null,
        tags: splitTagsFromCsvCell(pick("tags")),
        personalData: pick("personalData") || null,
        notes: pick("notes") || null,
        source: pick("source") || "csv_import",
      };
    })
    .filter((row): row is UserContactImportInput => Boolean(row));
}

async function buildContactCampaignMembershipIndex(userId: string) {
  const campaigns = await prisma.extensionCampaign.findMany({
    where: { ownerUserId: userId },
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      campaignName: true,
      status: true,
      scheduleAt: true,
      recipients: {
        select: {
          contactValue: true,
          status: true,
        },
      },
    },
  });

  const byPhone = new Map<string, ContactCampaignMembership[]>();

  for (const campaign of campaigns) {
    for (const recipient of campaign.recipients) {
      const normalizedPhone = normalizeContactPhone(recipient.contactValue);
      if (!normalizedPhone) continue;

      const current = byPhone.get(normalizedPhone) ?? [];
      current.push({
        campaignId: campaign.id,
        campaignName: campaign.campaignName,
        status: campaign.status,
        scheduleAt: campaign.scheduleAt?.toISOString() ?? null,
        recipientStatus: recipient.status,
      });
      byPhone.set(normalizedPhone, current);
    }
  }

  return byPhone;
}

export async function listUserContactsForUser(userId: string) {
  const [contacts, campaignMembershipsByPhone] = await Promise.all([
    prisma.userContact.findMany({
      where: { ownerUserId: userId },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    }),
    buildContactCampaignMembershipIndex(userId),
  ]);

  return contacts.map((contact) =>
    serializeContact(
      contact,
      campaignMembershipsByPhone.get(contact.normalizedPhone) ?? [],
    ),
  );
}

export async function listQuoteAssignmentsForUser(userId: string) {
  const sessions = await prisma.quoteSession.findMany({
    where: { ownerUserId: userId },
    orderBy: [{ updatedAt: "desc" }],
    take: 12,
    select: {
      publicId: true,
      updatedAt: true,
      scenarios: {
        orderBy: [{ updatedAt: "desc" }],
        take: 6,
        select: {
          id: true,
          label: true,
          updatedAt: true,
          programNameSnapshot: true,
          campusNameSnapshot: true,
        },
      },
    },
  });

  return sessions.map((session) => ({
    publicId: session.publicId,
    updatedAt: session.updatedAt.toISOString(),
    scenarios: session.scenarios.map((scenario) => ({
      id: scenario.id,
      label: buildScenarioLabel(scenario),
      updatedAt: scenario.updatedAt.toISOString(),
    })),
  }));
}

async function syncContactsMirror(userId: string) {
  const contacts = await prisma.userContact.findMany({
    where: { ownerUserId: userId },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
  });

  const sync = await syncContactsSnapshotToGoogle({
    userId,
    contacts: contacts.map((contact) => ({
      id: contact.id,
      contactName: contact.contactName,
      phone: contact.phone,
      normalizedPhone: contact.normalizedPhone,
      email: contact.email,
      tags: readTags(contact.tags),
      personalData: contact.personalData,
      notes: contact.notes,
      lastWhatsappMessageAt: contact.lastWhatsappMessageAt?.toISOString() ?? null,
      lastWhatsappMessageText: contact.lastWhatsappMessageText,
      campaignMessageCount: contact.campaignMessageCount,
      assignedQuoteSessionPublicId: contact.assignedQuoteSessionPublicId,
      assignedScenarioId: contact.assignedScenarioId,
      source: contact.source,
      updatedAt: contact.updatedAt.toISOString(),
    })),
  });

  if (sync.ok) {
    await prisma.userContact.updateMany({
      where: { ownerUserId: userId },
      data: { sheetSyncedAt: sync.syncedAt },
    });
  }

  return sync;
}

async function syncContactsMirrorSafe(userId: string) {
  try {
    return await syncContactsMirror(userId);
  } catch {
    return null;
  }
}

export async function getUserContactsBootstrap(userId: string) {
  const [contacts, quoteAssignments, google] = await Promise.all([
    listUserContactsForUser(userId),
    listQuoteAssignmentsForUser(userId),
    getAgendaIntegrationStatus(userId),
  ]);

  return {
    contacts,
    quoteAssignments,
    google: {
      ...google,
      contactsSheetName: GOOGLE_CONTACTS_SHEET_NAME,
      mode: "hybrid",
    },
  };
}

export async function upsertUserContactForUser(userId: string, input: UserContactInput) {
  const data = await buildUserContactData(userId, input);
  const contact = await prisma.userContact.upsert({
    where: {
      ownerUserId_normalizedPhone: {
        ownerUserId: userId,
        normalizedPhone: data.normalizedPhone,
      },
    },
    update: data,
    create: {
      ownerUserId: userId,
      campaignMessageCount: 0,
      ...data,
    },
  });

  await syncContactsMirrorSafe(userId);
  return serializeContact(contact);
}

async function findUserContactByMetaIdentity(
  userId: string,
  identity: MetaIdentityInput,
) {
  const normalizedPhone = normalizeContactPhone(identity.phone ?? "");
  const waId = normalizeMetaIdentityValue(identity.waId);
  const bsuid = normalizeMetaIdentityValue(identity.bsuid);

  const orFilters: Prisma.UserContactWhereInput[] = [];
  if (bsuid) orFilters.push({ bsuid });
  if (waId) orFilters.push({ waId });
  if (normalizedPhone) orFilters.push({ normalizedPhone });

  if (!orFilters.length) {
    return null;
  }

  const matches = await prisma.userContact.findMany({
    where: {
      ownerUserId: userId,
      OR: orFilters,
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "asc" }],
  });

  if (!matches.length) {
    return null;
  }

  return (
    matches.find((contact) => (bsuid ? contact.bsuid === bsuid : false)) ??
    matches.find((contact) => (waId ? contact.waId === waId : false)) ??
    matches.find((contact) => (normalizedPhone ? contact.normalizedPhone === normalizedPhone : false)) ??
    matches[0] ??
    null
  );
}

export async function upsertMetaIdentityForUser(userId: string, identity: MetaIdentityInput) {
  const now = new Date();
  const normalizedPhone = normalizeContactPhone(identity.phone ?? "");
  const waId = normalizeMetaIdentityValue(identity.waId);
  const bsuid = normalizeMetaIdentityValue(identity.bsuid);
  const parentBsuid = normalizeMetaIdentityValue(identity.parentBsuid);
  const whatsappUsername = normalizeMetaIdentityValue(identity.whatsappUsername);
  const profilePictureUrl = normalizeMetaIdentityValue(identity.profilePictureUrl);
  const profileSource = normalizeMetaIdentityValue(identity.profileSource) ?? "meta_webhook";
  const normalizedName =
    normalizeOptionalText(identity.contactName) ??
    whatsappUsername ??
    normalizedPhone ??
    waId ??
    bsuid;

  const existing = await findUserContactByMetaIdentity(userId, identity);

  if (!existing && !normalizedPhone) {
    return {
      contact: null,
      warning:
        "Meta identity arrived without a phone number and no matching contact exists yet. The current directory remains phone-centric, so no new contact was created.",
    };
  }

  const data: Prisma.UserContactUncheckedUpdateInput = {
    ...(normalizedName ? { contactName: normalizedName } : {}),
    ...(normalizedPhone ? { phone: identity.phone ?? normalizedPhone, normalizedPhone } : {}),
    ...(waId ? { waId } : {}),
    ...(bsuid ? { bsuid } : {}),
    ...(parentBsuid ? { parentBsuid } : {}),
    ...(whatsappUsername ? { whatsappUsername } : {}),
    ...(profilePictureUrl ? { profilePictureUrl } : {}),
    profileSource,
    lastIdentitySyncAt: now,
    ...(profilePictureUrl || whatsappUsername ? { lastProfileSyncAt: now } : {}),
    ...(identity.source ? { source: normalizeOptionalText(identity.source) ?? "meta_identity" } : {}),
  };

  const contact = existing
    ? await prisma.userContact.update({
        where: { id: existing.id },
        data,
      })
    : await prisma.userContact.create({
        data: {
          ownerUserId: userId,
          contactName: normalizedName ?? normalizedPhone,
          phone: identity.phone ?? normalizedPhone,
          normalizedPhone,
          waId,
          bsuid,
          parentBsuid,
          whatsappUsername,
          profilePictureUrl,
          profileSource,
          lastIdentitySyncAt: now,
          lastProfileSyncAt: profilePictureUrl || whatsappUsername ? now : null,
          source: normalizeOptionalText(identity.source) ?? "meta_identity",
        },
      });

  await syncContactsMirrorSafe(userId);
  return { contact: serializeContact(contact), warning: null };
}

export async function updateUserContactForUser(
  userId: string,
  contactId: string,
  input: UserContactInput,
) {
  const existing = await prisma.userContact.findFirst({
    where: { id: contactId, ownerUserId: userId },
    select: { id: true },
  });

  if (!existing) {
    throw new Error("El contacto ya no existe para este usuario.");
  }

  const data = await buildUserContactData(userId, input);
  const contact = await prisma.userContact.update({
    where: { id: contactId },
    data,
  });

  await syncContactsMirrorSafe(userId);
  return serializeContact(contact);
}

export async function deleteUserContactForUser(userId: string, contactId: string) {
  const contact = await prisma.userContact.findFirst({
    where: { id: contactId, ownerUserId: userId },
    select: { id: true },
  });
  if (!contact) {
    throw new Error("El contacto ya no existe para este usuario.");
  }

  await prisma.userContact.delete({
    where: { id: contactId },
  });

  await syncContactsMirrorSafe(userId);
  return { ok: true as const };
}

export async function importUserContactsForUser(
  userId: string,
  rows: UserContactImportInput[],
  source = "import",
) {
  const unique = new Map<string, UserContactImportInput>();

  for (const row of rows) {
    const normalizedPhone = normalizeContactPhone(row.phone);
    if (!normalizedPhone) continue;
    if (unique.has(normalizedPhone)) continue;
    unique.set(normalizedPhone, row);
  }

  const entries = Array.from(unique.values());
  if (!entries.length) {
    throw new Error("No se encontraron contactos válidos para importar.");
  }

  for (const row of entries) {
    const data = await buildUserContactData(userId, {
      contactName: row.contactName ?? row.phone,
      phone: row.phone,
      email: row.email ?? null,
      tags: row.tags ?? [],
      personalData: row.personalData ?? null,
      notes: row.notes ?? null,
      source: row.source ?? source,
    });

    await prisma.userContact.upsert({
      where: {
        ownerUserId_normalizedPhone: {
          ownerUserId: userId,
          normalizedPhone: data.normalizedPhone,
        },
      },
      update: data,
      create: {
        ownerUserId: userId,
        campaignMessageCount: 0,
        ...data,
      },
    });
  }

  await syncContactsMirrorSafe(userId);

  return {
    ok: true as const,
    importedCount: entries.length,
  };
}

export async function syncCampaignRecipientsToContacts(params: {
  userId: string;
  recipients: Array<{
    contactValue: string;
    contactName?: string | null;
  }>;
  source?: string | null;
}) {
  const rows = params.recipients.map((recipient) => ({
    phone: recipient.contactValue,
    contactName: recipient.contactName ?? null,
    source: params.source ?? "extension_campaign",
  }));

  if (!rows.length) return;
  await importUserContactsForUser(params.userId, rows, params.source ?? "extension_campaign");
}

export async function recordCampaignDispatchForContacts(params: {
  userId: string;
  campaignId: string;
  results: Array<{
    recipientId: string;
    status: "sent" | "failed" | "queued";
    error?: string | null;
  }>;
  resolveMessage: (recipient: {
    contactName?: string | null;
    contactValue: string;
  }) => string;
}) {
  const successfulRecipientIds = params.results
    .filter((result) => result.status === "sent")
    .map((result) => result.recipientId)
    .filter(Boolean);

  if (!successfulRecipientIds.length) {
    return;
  }

  const recipients = await prisma.extensionCampaignRecipient.findMany({
    where: {
      id: { in: successfulRecipientIds },
      campaign: {
        id: params.campaignId,
        ownerUserId: params.userId,
      },
    },
    select: {
      contactValue: true,
      contactName: true,
    },
  });

  const now = new Date();

  await Promise.all(
    recipients.map((recipient) => {
      const normalizedPhone = normalizeContactPhone(recipient.contactValue);
      if (!normalizedPhone) return Promise.resolve(null);
      const message = params.resolveMessage(recipient);

      return prisma.userContact.upsert({
        where: {
          ownerUserId_normalizedPhone: {
            ownerUserId: params.userId,
            normalizedPhone,
          },
        },
        update: {
          contactName: normalizeText(recipient.contactName) || normalizedPhone,
          phone: recipient.contactValue,
          lastWhatsappMessageAt: now,
          lastWhatsappMessageText: message || null,
          campaignMessageCount: { increment: 1 },
          source: "extension_campaign",
        },
        create: {
          ownerUserId: params.userId,
          contactName: normalizeText(recipient.contactName) || normalizedPhone,
          phone: recipient.contactValue,
          normalizedPhone,
          campaignMessageCount: 1,
          lastWhatsappMessageAt: now,
          lastWhatsappMessageText: message || null,
          source: "extension_campaign",
        },
      });
    }),
  );

  await syncContactsMirrorSafe(params.userId);
}

export async function recordDirectWhatsappMessageForContact(params: {
  userId: string;
  to: string;
  message: string;
  contactName?: string | null;
  waId?: string | null;
  bsuid?: string | null;
  parentBsuid?: string | null;
  whatsappUsername?: string | null;
  profilePictureUrl?: string | null;
  profileSource?: string | null;
  source?: string | null;
}) {
  const normalizedPhone = normalizeContactPhone(params.to);
  if (!normalizedPhone) {
    throw new Error("Número de destino inválido para registrar actividad de WhatsApp.");
  }

  const normalizedName = normalizeText(params.contactName);
  const now = new Date();

  const identityResult = await upsertMetaIdentityForUser(params.userId, {
    phone: params.to,
    waId: params.waId,
    bsuid: params.bsuid,
    parentBsuid: params.parentBsuid,
    contactName: normalizedName || params.to,
    whatsappUsername: params.whatsappUsername,
    profilePictureUrl: params.profilePictureUrl,
    profileSource: params.profileSource ?? "meta_direct",
    source: params.source ?? "meta_direct",
  });

  const contactId = identityResult.contact?.id;
  const contact = contactId
    ? await prisma.userContact.update({
        where: { id: contactId },
        data: {
          phone: params.to,
          normalizedPhone,
          lastWhatsappMessageAt: now,
          lastWhatsappMessageText: params.message || null,
          campaignMessageCount: { increment: 1 },
          ...(normalizedName ? { contactName: normalizedName } : {}),
          ...(params.source ? { source: params.source } : {}),
        },
      })
    : await prisma.userContact.upsert({
        where: {
          ownerUserId_normalizedPhone: {
            ownerUserId: params.userId,
            normalizedPhone,
          },
        },
        update: {
          phone: params.to,
          lastWhatsappMessageAt: now,
          lastWhatsappMessageText: params.message || null,
          campaignMessageCount: { increment: 1 },
          ...(normalizedName ? { contactName: normalizedName } : {}),
          ...(params.source ? { source: params.source } : {}),
        },
        create: {
          ownerUserId: params.userId,
          contactName: normalizedName || params.to,
          phone: params.to,
          normalizedPhone,
          campaignMessageCount: 1,
          lastWhatsappMessageAt: now,
          lastWhatsappMessageText: params.message || null,
          source: params.source ?? "meta_direct",
        },
      });

  await syncContactsMirrorSafe(params.userId);
  return serializeContact(contact);
}

export async function forceSyncUserContactsForUser(userId: string) {
  return syncContactsMirror(userId);
}
