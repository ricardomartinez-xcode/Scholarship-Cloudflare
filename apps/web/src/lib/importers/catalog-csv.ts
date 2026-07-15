import { CampusKind, OrgRole, Prisma } from "@prisma/client";

import {
  buildImportHeaderMap,
  findImportColumnIndex,
  parseImportDelimitedText,
  readImportCell,
} from "@/lib/importers/global-import-normalization";
import { prisma } from "@/lib/prisma";

export type CatalogImportAction = "create" | "update" | "noop";
export type OrganizationImportRow = { rowNumber: number; action: CatalogImportAction; existingId: string | null; displayName: string; isActive: boolean };
export type CampusImportRow = { rowNumber: number; action: CatalogImportAction; existingId: string | null; code: string; metaKey: string; name: string; slug: string; tier: string | null; kind: CampusKind; isActive: boolean; sortOrder: number; address: string | null; phone: string | null; whatsapp: string | null };
export type CatalogImportSummary = { processed: number; ready: number; created: number; updated: number; unchanged: number; warnings: string[]; errors: string[] };
export type OrganizationImportPayload = { rows: OrganizationImportRow[] };
export type CampusImportPayload = { rows: CampusImportRow[] };
export type OrganizationCatalogSnapshot = { kind: "organizations"; organizations: Array<{ id: string; displayName: string; isActive: boolean }> };
export type CampusCatalogSnapshot = { kind: "campuses"; campuses: Array<{ id: string; code: string; metaKey: string; name: string; slug: string; tier: string | null; kind: CampusKind; isActive: boolean; sortOrder: number; address: string | null; phone: string | null; whatsapp: string | null }> };

const ORGANIZATION_HEADERS = {
  displayName: ["displayname", "display_name", "nombre", "organizacion", "organización"],
  isActive: ["isactive", "is_active", "activo", "activa", "estado"],
} as const;
const CAMPUS_HEADERS = {
  code: ["code", "codigo", "código"], metaKey: ["metakey", "meta_key", "clave"], name: ["name", "nombre", "plantel"], slug: ["slug"], tier: ["tier", "nivel"], kind: ["kind", "tipo"], isActive: ["isactive", "is_active", "activo", "activa", "estado"], sortOrder: ["sortorder", "sort_order", "orden"], address: ["address", "direccion", "dirección"], phone: ["phone", "telefono", "teléfono"], whatsapp: ["whatsapp"],
} as const;

function normalizeSpace(value: unknown) { return String(value ?? "").replace(/\s+/g, " ").trim(); }
function normalizedKey(value: unknown) { return normalizeSpace(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); }
function strictBoolean(value: string, defaultValue = true) {
  const normalized = normalizedKey(value);
  if (!normalized) return { ok: true as const, value: defaultValue };
  if (["1", "true", "si", "yes", "activo", "activa"].includes(normalized)) return { ok: true as const, value: true };
  if (["0", "false", "no", "inactivo", "inactiva"].includes(normalized)) return { ok: true as const, value: false };
  return { ok: false as const, value: defaultValue };
}
function actionSummary<T extends { action: CatalogImportAction }>(rows: T[], errors: string[], warnings: string[]): CatalogImportSummary {
  return { processed: rows.length + errors.length, ready: rows.length, created: rows.filter((row) => row.action === "create").length, updated: rows.filter((row) => row.action === "update").length, unchanged: rows.filter((row) => row.action === "noop").length, warnings, errors };
}

export async function captureOrganizationsSnapshot(): Promise<OrganizationCatalogSnapshot> {
  return { kind: "organizations", organizations: await prisma.organization.findMany({ orderBy: [{ createdAt: "asc" }], select: { id: true, displayName: true, isActive: true } }) };
}
export async function captureCampusesSnapshot(): Promise<CampusCatalogSnapshot> {
  return { kind: "campuses", campuses: await prisma.campus.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, code: true, metaKey: true, name: true, slug: true, tier: true, kind: true, isActive: true, sortOrder: true, address: true, phone: true, whatsapp: true } }) };
}

export async function prepareOrganizationsCsvImport(file: File) {
  const matrix = parseImportDelimitedText(await file.text());
  if (matrix.length < 2) throw new Error("El CSV debe incluir encabezado y al menos una organización.");
  const headerMap = buildImportHeaderMap(matrix[0] ?? []);
  const nameIndex = findImportColumnIndex(headerMap, ORGANIZATION_HEADERS.displayName);
  const activeIndex = findImportColumnIndex(headerMap, ORGANIZATION_HEADERS.isActive);
  if (nameIndex < 0) throw new Error("Falta la columna obligatoria display_name o nombre.");
  const existing = await prisma.organization.findMany({ select: { id: true, displayName: true, isActive: true } });
  const existingByName = new Map(existing.map((row) => [normalizedKey(row.displayName), row]));
  const seen = new Set<string>(); const rows: OrganizationImportRow[] = []; const errors: string[] = []; const warnings: string[] = [];
  for (let index = 1; index < matrix.length; index += 1) {
    const source = matrix[index] ?? []; const rowNumber = index + 1;
    const displayName = normalizeSpace(readImportCell(source, nameIndex)); const key = normalizedKey(displayName); const parsedActive = strictBoolean(readImportCell(source, activeIndex), true);
    if (displayName.length < 3 || displayName.length > 80) { errors.push(`Fila ${rowNumber}: nombre debe contener entre 3 y 80 caracteres.`); continue; }
    if (!parsedActive.ok) { errors.push(`Fila ${rowNumber}: is_active debe ser true/false, si/no o 1/0.`); continue; }
    if (seen.has(key)) { errors.push(`Fila ${rowNumber}: organización duplicada dentro del archivo (${displayName}).`); continue; }
    seen.add(key);
    const current = existingByName.get(key) ?? null;
    const action: CatalogImportAction = !current ? "create" : current.displayName !== displayName || current.isActive !== parsedActive.value ? "update" : "noop";
    rows.push({ rowNumber, action, existingId: current?.id ?? null, displayName, isActive: parsedActive.value });
  }
  return { previewRows: rows, payload: { rows } satisfies OrganizationImportPayload, summary: actionSummary(rows, errors, warnings) };
}

export async function prepareCampusesCsvImport(file: File) {
  const matrix = parseImportDelimitedText(await file.text());
  if (matrix.length < 2) throw new Error("El CSV debe incluir encabezado y al menos un plantel.");
  const headerMap = buildImportHeaderMap(matrix[0] ?? []);
  const indexes = Object.fromEntries(Object.entries(CAMPUS_HEADERS).map(([key, aliases]) => [key, findImportColumnIndex(headerMap, aliases)])) as Record<keyof typeof CAMPUS_HEADERS, number>;
  for (const required of ["code", "metaKey", "name", "slug", "kind"] as const) if (indexes[required] < 0) throw new Error(`Falta la columna obligatoria ${required}.`);
  const existing = await prisma.campus.findMany({ select: { id: true, code: true, metaKey: true, name: true, slug: true, tier: true, kind: true, isActive: true, sortOrder: true, address: true, phone: true, whatsapp: true } });
  const byCode = new Map(existing.map((row) => [row.code.toUpperCase(), row])); const metaOwner = new Map(existing.map((row) => [row.metaKey.toUpperCase(), row.id])); const slugOwner = new Map(existing.map((row) => [row.slug.toLowerCase(), row.id]));
  const seenCodes = new Set<string>(); const seenMeta = new Set<string>(); const seenSlugs = new Set<string>(); const rows: CampusImportRow[] = []; const errors: string[] = []; const warnings: string[] = [];
  for (let index = 1; index < matrix.length; index += 1) {
    const source = matrix[index] ?? []; const rowNumber = index + 1; const errorCountBefore = errors.length;
    const code = readImportCell(source, indexes.code).trim().toUpperCase(); const metaKey = readImportCell(source, indexes.metaKey).trim().toUpperCase(); const name = normalizeSpace(readImportCell(source, indexes.name)); const slug = readImportCell(source, indexes.slug).trim().toLowerCase(); const tier = normalizeSpace(readImportCell(source, indexes.tier)) || null; const kindRaw = normalizedKey(readImportCell(source, indexes.kind)); const kind = kindRaw === "online" || kindRaw === "en linea" ? CampusKind.online : kindRaw === "campus" || kindRaw === "plantel" ? CampusKind.campus : null; const parsedActive = strictBoolean(readImportCell(source, indexes.isActive), true); const sortRaw = readImportCell(source, indexes.sortOrder); const sortOrder = sortRaw ? Number(sortRaw) : 0; const address = normalizeSpace(readImportCell(source, indexes.address)) || null; const phone = normalizeSpace(readImportCell(source, indexes.phone)) || null; const whatsapp = normalizeSpace(readImportCell(source, indexes.whatsapp)) || null;
    if (!/^[A-Z0-9_-]{2,32}$/.test(code)) errors.push(`Fila ${rowNumber}: code inválido.`);
    if (!/^[A-Z0-9_-]{2,64}$/.test(metaKey)) errors.push(`Fila ${rowNumber}: meta_key inválido.`);
    if (name.length < 2 || name.length > 120) errors.push(`Fila ${rowNumber}: nombre inválido.`);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) errors.push(`Fila ${rowNumber}: slug inválido.`);
    if (!kind) errors.push(`Fila ${rowNumber}: kind debe ser campus u online.`);
    if (!parsedActive.ok) errors.push(`Fila ${rowNumber}: is_active inválido.`);
    if (!Number.isInteger(sortOrder) || sortOrder < 0) errors.push(`Fila ${rowNumber}: sort_order debe ser entero mayor o igual a cero.`);
    if (seenCodes.has(code)) errors.push(`Fila ${rowNumber}: code duplicado dentro del archivo (${code}).`);
    if (seenMeta.has(metaKey)) errors.push(`Fila ${rowNumber}: meta_key duplicado dentro del archivo (${metaKey}).`);
    if (seenSlugs.has(slug)) errors.push(`Fila ${rowNumber}: slug duplicado dentro del archivo (${slug}).`);
    seenCodes.add(code); seenMeta.add(metaKey); seenSlugs.add(slug);
    const current = byCode.get(code) ?? null; const conflictingMetaOwner = metaOwner.get(metaKey); const conflictingSlugOwner = slugOwner.get(slug);
    if (conflictingMetaOwner && conflictingMetaOwner !== current?.id) errors.push(`Fila ${rowNumber}: meta_key ya pertenece a otro plantel.`);
    if (conflictingSlugOwner && conflictingSlugOwner !== current?.id) errors.push(`Fila ${rowNumber}: slug ya pertenece a otro plantel.`);
    if (errors.length > errorCountBefore || !code || !metaKey || !name || !slug || !kind) continue;
    const changed = current && (current.metaKey !== metaKey || current.name !== name || current.slug !== slug || current.tier !== tier || current.kind !== kind || current.isActive !== parsedActive.value || current.sortOrder !== sortOrder || current.address !== address || current.phone !== phone || current.whatsapp !== whatsapp);
    const action: CatalogImportAction = !current ? "create" : changed ? "update" : "noop";
    rows.push({ rowNumber, action, existingId: current?.id ?? null, code, metaKey, name, slug, tier, kind, isActive: parsedActive.value, sortOrder, address, phone, whatsapp });
  }
  return { previewRows: rows, payload: { rows } satisfies CampusImportPayload, summary: actionSummary(rows, errors, warnings) };
}

export async function applyOrganizationsImport(input: { payload: OrganizationImportPayload; actorUserId: string }) {
  let created = 0; let updated = 0; let unchanged = 0;
  await prisma.$transaction(async (tx) => {
    for (const row of input.payload.rows) {
      if (row.action === "noop") { unchanged += 1; continue; }
      if (row.existingId) { await tx.organization.update({ where: { id: row.existingId }, data: { displayName: row.displayName, isActive: row.isActive } }); updated += 1; }
      else { const organization = await tx.organization.create({ data: { displayName: row.displayName, isActive: row.isActive } }); await tx.organizationMember.create({ data: { organizationId: organization.id, userId: input.actorUserId, role: OrgRole.owner } }); created += 1; }
    }
  });
  return { processed: input.payload.rows.length, created, updated, unchanged };
}
export async function applyCampusesImport(payload: CampusImportPayload) {
  let created = 0; let updated = 0; let unchanged = 0;
  await prisma.$transaction(async (tx) => {
    for (const row of payload.rows) {
      if (row.action === "noop") { unchanged += 1; continue; }
      const data = { metaKey: row.metaKey, name: row.name, slug: row.slug, tier: row.tier, kind: row.kind, isActive: row.isActive, sortOrder: row.sortOrder, address: row.address, phone: row.phone, whatsapp: row.whatsapp };
      if (row.existingId) { await tx.campus.update({ where: { id: row.existingId }, data }); updated += 1; } else { await tx.campus.create({ data: { code: row.code, ...data } }); created += 1; }
    }
  });
  return { processed: payload.rows.length, created, updated, unchanged };
}
export async function restoreOrganizationsSnapshot(snapshot: OrganizationCatalogSnapshot, payload: OrganizationImportPayload) {
  const ids = new Set(snapshot.organizations.map((row) => row.id)); const names = new Set(payload.rows.map((row) => normalizedKey(row.displayName)));
  await prisma.$transaction(async (tx) => {
    for (const row of snapshot.organizations) await tx.organization.upsert({ where: { id: row.id }, update: { displayName: row.displayName, isActive: row.isActive }, create: row });
    const current = await tx.organization.findMany({ select: { id: true, displayName: true } }); const deactivateIds = current.filter((row) => !ids.has(row.id) && names.has(normalizedKey(row.displayName))).map((row) => row.id);
    if (deactivateIds.length) await tx.organization.updateMany({ where: { id: { in: deactivateIds } }, data: { isActive: false } });
  });
}
export async function restoreCampusesSnapshot(snapshot: CampusCatalogSnapshot, payload: CampusImportPayload) {
  const ids = new Set(snapshot.campuses.map((row) => row.id)); const codes = new Set(payload.rows.map((row) => row.code));
  await prisma.$transaction(async (tx) => {
    for (const row of snapshot.campuses) await tx.campus.upsert({ where: { id: row.id }, update: { code: row.code, metaKey: row.metaKey, name: row.name, slug: row.slug, tier: row.tier, kind: row.kind, isActive: row.isActive, sortOrder: row.sortOrder, address: row.address, phone: row.phone, whatsapp: row.whatsapp }, create: row });
    const current = await tx.campus.findMany({ select: { id: true, code: true } }); const deactivateIds = current.filter((row) => !ids.has(row.id) && codes.has(row.code)).map((row) => row.id);
    if (deactivateIds.length) await tx.campus.updateMany({ where: { id: { in: deactivateIds } }, data: { isActive: false } });
  });
}
export function asJsonSnapshot(value: OrganizationCatalogSnapshot | CampusCatalogSnapshot) { return value as unknown as Prisma.InputJsonValue; }
