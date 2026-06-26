import type { BenefitBusinessLine, Prisma, ProgramOfferingDelivery } from "@prisma/client";

import { normalizeKey } from "@/lib/text-normalize";
import { d1All, d1First, parseD1Json, type D1Value } from "@/lib/cloudflare/d1";

function bool(value: unknown) {
  return value === true || value === 1 || value === "1";
}

function intArray(value: unknown) {
  return parseD1Json<number[]>(value, []).map((entry) => Number(entry)).filter(Number.isFinite);
}

function placeholders(values: unknown[]) {
  return values.map(() => "?").join(", ");
}

export type D1CatalogProgram = {
  id: string;
  name: string;
  nameNormalized: string;
  category: string | null;
  level: string | null;
  businessLine: BenefitBusinessLine | null;
  planPdfUrl: string | null;
  brochurePdfUrl: string | null;
  planDriveLink: string | null;
  planUrl: string | null;
  _count: { offerings: number };
};

type D1ProgramRow = {
  id: string;
  name: string;
  name_normalized: string;
  category: string | null;
  level: string | null;
  business_line: string | null;
  plan_pdf_url: string | null;
  brochure_pdf_url: string | null;
  plan_drive_link: string | null;
  plan_url: string | null;
  offerings_count: number | null;
};

export function mapD1CatalogProgram(row: D1ProgramRow): D1CatalogProgram {
  return {
    id: row.id,
    name: row.name,
    nameNormalized: row.name_normalized,
    category: row.category,
    level: row.level,
    businessLine: row.business_line as BenefitBusinessLine | null,
    planPdfUrl: row.plan_pdf_url,
    brochurePdfUrl: row.brochure_pdf_url,
    planDriveLink: row.plan_drive_link,
    planUrl: row.plan_url,
    _count: { offerings: Number(row.offerings_count ?? 0) },
  };
}

export async function listD1ProgramCatalog() {
  const rows = await d1All<D1ProgramRow>(
    `SELECT p.id, p.name, p.name_normalized, p.category, p.level, p.business_line,
            p.plan_pdf_url, p.brochure_pdf_url, p.plan_drive_link, p.plan_url,
            COUNT(po.id) AS offerings_count
     FROM program p
     LEFT JOIN program_offering po ON po.program_id = p.id
     GROUP BY p.id
     ORDER BY p.name ASC
     LIMIT 400`,
  );
  return rows.map(mapD1CatalogProgram);
}

export type D1Campus = {
  id: string;
  code: string;
  metaKey: string;
  name: string;
  slug: string;
  tier: string | null;
  kind: "campus" | "online";
};

type D1CampusRow = {
  id: string;
  code: string;
  meta_key: string;
  name: string;
  slug: string;
  tier: string | null;
  kind: "campus" | "online";
};

function mapD1Campus(row: D1CampusRow): D1Campus {
  return {
    id: row.id,
    code: row.code,
    metaKey: row.meta_key,
    name: row.name,
    slug: row.slug,
    tier: row.tier,
    kind: row.kind,
  };
}

export async function listD1ActiveCampuses() {
  const rows = await d1All<D1CampusRow>(
    `SELECT id, code, meta_key, name, slug, tier, kind
     FROM campus
     WHERE is_active = 1
     ORDER BY name ASC`,
  );
  return rows.map(mapD1Campus);
}

export async function findD1CampusId(campusRaw: string) {
  const raw = campusRaw.trim();
  if (!raw) return null;

  const exact = await d1First<{ id: string }>(
    `SELECT id
     FROM campus
     WHERE is_active = 1
       AND (lower(code) = lower(?) OR lower(meta_key) = lower(?) OR lower(name) = lower(?) OR lower(slug) = lower(?))
     LIMIT 1`,
    [raw, raw, raw, raw],
  );
  if (exact?.id) return exact.id;

  const normalized = normalizeKey(raw);
  const campuses = await listD1ActiveCampuses();
  return (
    campuses.find(
      (campus) =>
        normalizeKey(campus.code) === normalized ||
        normalizeKey(campus.metaKey) === normalized ||
        normalizeKey(campus.name) === normalized ||
        normalizeKey(campus.slug) === normalized,
    )?.id ?? null
  );
}

export type D1PriceOverride = {
  id: string;
  scope: string;
  targetKeys: Prisma.JsonValue;
  newPrice: number;
  isActive: boolean;
  notes: string | null;
  updatedBy: string | null;
};

export async function listD1PriceOverrides(scope: string) {
  const rows = await d1All<{
    id: string;
    scope: string;
    target_keys: string;
    new_price: number;
    is_active: number;
    notes: string | null;
    updated_by: string | null;
  }>(
    `SELECT id, scope, target_keys, new_price, is_active, notes, updated_by
     FROM admin_price_override
     WHERE scope = ? AND is_active = 1`,
    [scope],
  );
  return rows.map(
    (row): D1PriceOverride => ({
      id: row.id,
      scope: row.scope,
      targetKeys: parseD1Json(row.target_keys, {}) as Prisma.JsonValue,
      newPrice: Number(row.new_price),
      isActive: bool(row.is_active),
      notes: row.notes,
      updatedBy: row.updated_by,
    }),
  );
}

type D1OfferingRow = {
  id: string;
  campus_id: string;
  program_id: string;
  cycle: string;
  track: string | null;
  delivery: ProgramOfferingDelivery;
  escolarizado: number;
  ejecutivo: number;
  escolarizado_schedule: string | null;
  ejecutivo_schedule: string | null;
  line_of_business: string | null;
  pricing_plans: string | null;
  module_count: number | null;
  subjects_by_module: string | null;
  campus_code: string;
  campus_meta_key: string;
  campus_name: string;
  campus_slug: string;
  campus_tier: string | null;
  campus_kind: "campus" | "online";
  program_name: string;
  program_business_line: string | null;
  program_level: string | null;
  program_category: string | null;
  program_plan_pdf_url: string | null;
  program_brochure_pdf_url: string | null;
  program_plan_drive_link: string | null;
  program_plan_url: string | null;
};

function mapD1Offering(row: D1OfferingRow) {
  return {
    id: row.id,
    campusId: row.campus_id,
    programId: row.program_id,
    cycle: row.cycle,
    track: row.track,
    delivery: row.delivery,
    escolarizado: bool(row.escolarizado),
    ejecutivo: bool(row.ejecutivo),
    escolarizadoSchedule: row.escolarizado_schedule,
    ejecutivoSchedule: row.ejecutivo_schedule,
    lineOfBusiness: row.line_of_business,
    pricingPlans: intArray(row.pricing_plans),
    moduleCount: row.module_count,
    subjectsByModule: row.subjects_by_module,
    campus: {
      id: row.campus_id,
      code: row.campus_code,
      metaKey: row.campus_meta_key,
      name: row.campus_name,
      slug: row.campus_slug,
      tier: row.campus_tier,
      kind: row.campus_kind,
    },
    program: {
      id: row.program_id,
      name: row.program_name,
      businessLine: row.program_business_line as BenefitBusinessLine | null,
      level: row.program_level,
      category: row.program_category,
      planPdfUrl: row.program_plan_pdf_url,
      brochurePdfUrl: row.program_brochure_pdf_url,
      planDriveLink: row.program_plan_drive_link,
      planUrl: row.program_plan_url,
    },
  };
}

const OFFERING_SELECT = `po.id, po.campus_id, po.program_id, po.cycle, po.track, po.delivery,
  po.escolarizado, po.ejecutivo, po.escolarizado_schedule, po.ejecutivo_schedule,
  po.line_of_business, po.pricing_plans, po.module_count, po.subjects_by_module,
  c.code AS campus_code, c.meta_key AS campus_meta_key, c.name AS campus_name,
  c.slug AS campus_slug, c.tier AS campus_tier, c.kind AS campus_kind,
  p.name AS program_name, p.business_line AS program_business_line, p.level AS program_level,
  p.category AS program_category, p.plan_pdf_url AS program_plan_pdf_url,
  p.brochure_pdf_url AS program_brochure_pdf_url, p.plan_drive_link AS program_plan_drive_link,
  p.plan_url AS program_plan_url`;

export async function listD1ActiveOfferingsForPricing() {
  const rows = await d1All<D1OfferingRow>(
    `SELECT ${OFFERING_SELECT}
     FROM program_offering po
     INNER JOIN campus c ON c.id = po.campus_id
     INNER JOIN program p ON p.id = po.program_id
     WHERE po.is_active = 1 AND c.is_active = 1
     ORDER BY p.name ASC`,
  );
  return rows.map(mapD1Offering);
}

export async function listD1OfertaOfferings(params: { cycle: string; campusId?: string | null }) {
  const values: D1Value[] = [params.cycle];
  const campusClause = params.campusId ? "AND po.campus_id = ?" : "";
  if (params.campusId) values.push(params.campusId);
  const rows = await d1All<D1OfferingRow>(
    `SELECT ${OFFERING_SELECT}
     FROM program_offering po
     INNER JOIN campus c ON c.id = po.campus_id
     INNER JOIN program p ON p.id = po.program_id
     WHERE po.is_active = 1 AND c.is_active = 1 AND po.cycle = ?
     ${campusClause}
     ORDER BY p.name ASC`,
    values,
  );
  return rows.map(mapD1Offering);
}

export async function listD1ProgramOfferingModuleMetaById(ids: string[]) {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
  if (!uniqueIds.length) return new Map<string, { subjectsByModule: string | null; moduleCount: number | null }>();
  const rows = await d1All<{
    id: string;
    subjects_by_module: string | null;
    module_count: number | null;
  }>(
    `SELECT id, subjects_by_module, module_count
     FROM program_offering
     WHERE id IN (${placeholders(uniqueIds)})`,
    uniqueIds,
  );
  return new Map(
    rows.map((row) => [
      row.id,
      { subjectsByModule: row.subjects_by_module, moduleCount: row.module_count },
    ]),
  );
}

export async function listD1CampusAcademicFees(campusId: string | null) {
  if (!campusId) return [];
  const rows = await d1All<{
    id: string;
    code: string;
    concept: string;
    cost_mxn: number;
    section: string;
    override_cost_mxn: number | null;
  }>(
    `SELECT f.id, f.code, f.concept, f.cost_mxn, f.section, cf.override_cost_mxn
     FROM campus_academic_fee cf
     INNER JOIN academic_fee f ON f.id = cf.academic_fee_id
     WHERE cf.campus_id = ? AND cf.is_active = 1 AND f.is_active = 1
     ORDER BY f.section ASC, f.concept ASC`,
    [campusId],
  );
  return rows.map((row) => ({
    id: row.id,
    code: row.code,
    concept: row.concept,
    costMxn: row.override_cost_mxn ?? row.cost_mxn,
    section: row.section,
  }));
}

export async function listD1Bulletins(campusRaw: string) {
  const campusId = campusRaw ? await findD1CampusId(campusRaw) : null;
  const params: D1Value[] = [];
  const campusClause = campusRaw ? "WHERE b.campus_id = ?" : "";
  if (campusRaw) {
    if (!campusId) return [];
    params.push(campusId);
  }
  const rows = await d1All<{
    id: string;
    cycle: string | null;
    file_name: string;
    file_path: string;
    campus_id: string;
    campus_code: string;
    campus_meta_key: string;
    campus_name: string;
    campus_slug: string;
  }>(
    `SELECT b.id, b.cycle, b.file_name, b.file_path,
            c.id AS campus_id, c.code AS campus_code, c.meta_key AS campus_meta_key,
            c.name AS campus_name, c.slug AS campus_slug
     FROM bulletin b
     INNER JOIN campus c ON c.id = b.campus_id
     ${campusClause}
     ORDER BY c.name ASC, b.file_name ASC`,
    params,
  );
  return rows.map((row) => ({
    id: row.id,
    cycle: row.cycle,
    fileName: row.file_name,
    filePath: row.file_path,
    campus: {
      id: row.campus_id,
      code: row.campus_code,
      metaKey: row.campus_meta_key,
      name: row.campus_name,
      slug: row.campus_slug,
    },
  }));
}

export async function listD1OfferedProgramIds(params: {
  campus: string;
  cycle: string;
  modality: "online" | "mixta" | "presencial" | null;
}) {
  const campus = params.campus.trim();
  const cycle = params.cycle.trim();
  if (!campus || !cycle) return null;

  const values: D1Value[] = [cycle, campus, campus, campus];
  let modalityClause = "";
  if (params.modality === "online") {
    modalityClause = "AND po.delivery = 'ONLINE'";
  } else if (params.modality === "mixta") {
    modalityClause = "AND po.delivery = 'CAMPUS' AND po.ejecutivo = 1";
  } else if (params.modality === "presencial") {
    modalityClause = "AND po.delivery = 'CAMPUS' AND (po.escolarizado = 1 OR po.ejecutivo = 0)";
  }

  const rows = await d1All<{ program_id: string }>(
    `SELECT po.program_id
     FROM program_offering po
     INNER JOIN campus c ON c.id = po.campus_id
     WHERE po.is_active = 1
       AND po.cycle = ?
       AND c.is_active = 1
       AND (c.meta_key = ? OR c.code = ? OR c.name = ?)
       ${modalityClause}`,
    values,
  );
  return new Set(rows.map((row) => row.program_id));
}

export async function getD1SidebarInfoValue(key: string) {
  return d1First<{ value: string | null; is_active: number }>(
    "SELECT value, is_active FROM admin_sidebar_info WHERE key = ? LIMIT 1",
    [key],
  );
}
