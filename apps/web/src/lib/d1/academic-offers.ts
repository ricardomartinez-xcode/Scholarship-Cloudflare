import type { AppD1Database } from "./contracts";
import { parseJsonObject } from "./json";

export type AcademicOfferModality = "online" | "mixta" | "presencial" | null;

export interface ListAcademicOffersFilters {
  page: number;
  pageSize: number;
  cycle?: string | null;
  campus?: string | null;
  program?: string | null;
  plan?: number | null;
  status?: "active" | "inactive" | null;
  modality?: AcademicOfferModality;
}

interface CountRow {
  total: number | string;
}

interface OfferRow {
  id: string;
  cycle: string;
  track: string | null;
  delivery: string;
  escolarizado: number | boolean;
  ejecutivo: number | boolean;
  pricing_plans: string | null;
  module_count: number | null;
  subjects_by_module: string | null;
  line_of_business: string | null;
  is_active: number | boolean;
  archived_at: string | null;
  archived_reason: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  campus_id: string;
  campus_code: string;
  campus_name: string;
  campus_meta_key: string;
  campus_tier: string | null;
  campus_kind: string;
  program_id: string;
  program_name: string;
  program_business_line: string | null;
  program_level: string | null;
  program_category: string | null;
}

export interface D1AcademicOffer {
  id: string;
  cycle: string;
  track: string | null;
  delivery: string;
  escolarizado: boolean;
  ejecutivo: boolean;
  pricingPlans: number[];
  moduleCount: number | null;
  subjectsByModule: string | null;
  lineOfBusiness: string | null;
  isActive: boolean;
  archivedAt: string | null;
  archivedReason: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  campus: {
    id: string;
    code: string;
    name: string;
    metaKey: string;
    tier: string | null;
    kind: string;
  };
  program: {
    id: string;
    name: string;
    businessLine: string | null;
    level: string | null;
    category: string | null;
  };
}

function bool(value: number | boolean): boolean {
  return value === true || value === 1;
}

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed || null;
}

function parsePricingPlans(value: string | null): number[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => Number(entry))
      .filter((entry) => Number.isInteger(entry) && entry > 0);
  } catch {
    return [];
  }
}

function mapOffer(row: OfferRow): D1AcademicOffer {
  return {
    id: row.id,
    cycle: row.cycle,
    track: row.track,
    delivery: row.delivery,
    escolarizado: bool(row.escolarizado),
    ejecutivo: bool(row.ejecutivo),
    pricingPlans: parsePricingPlans(row.pricing_plans),
    moduleCount: row.module_count,
    subjectsByModule: row.subjects_by_module,
    lineOfBusiness: row.line_of_business,
    isActive: bool(row.is_active),
    archivedAt: row.archived_at,
    archivedReason: row.archived_reason,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    campus: {
      id: row.campus_id,
      code: row.campus_code,
      name: row.campus_name,
      metaKey: row.campus_meta_key,
      tier: row.campus_tier,
      kind: row.campus_kind,
    },
    program: {
      id: row.program_id,
      name: row.program_name,
      businessLine: row.program_business_line,
      level: row.program_level,
      category: row.program_category,
    },
  };
}

/**
 * D1 equivalent of the former Prisma read query. It deliberately supports
 * only fixed query fragments and bound values; client parameters never alter
 * table names, columns or ordering.
 */
export async function listD1AcademicOffers(
  db: AppD1Database,
  filters: ListAcademicOffersFilters,
): Promise<{ total: number; offers: D1AcademicOffer[] }> {
  const where: string[] = [];
  const params: unknown[] = [];

  const cycle = clean(filters.cycle);
  const campus = clean(filters.campus);
  const program = clean(filters.program);

  if (cycle) {
    where.push("po.cycle = ?");
    params.push(cycle);
  }
  if (campus) {
    where.push(
      "(lower(c.code) = lower(?) OR lower(c.meta_key) = lower(?) OR lower(c.slug) = lower(?) OR lower(c.name) LIKE lower(?))",
    );
    params.push(campus, campus, campus, `%${campus}%`);
  }
  if (program) {
    where.push("(lower(p.name) LIKE lower(?) OR lower(p.name_normalized) LIKE lower(?))");
    params.push(`%${program}%`, `%${program}%`);
  }
  if (filters.plan && Number.isInteger(filters.plan) && filters.plan > 0) {
    where.push(
      "EXISTS (SELECT 1 FROM json_each(COALESCE(po.pricing_plans, '[]')) plans WHERE CAST(plans.value AS INTEGER) = ?)",
    );
    params.push(filters.plan);
  }
  if (filters.status === "active") {
    where.push("po.is_active = 1");
  }
  if (filters.status === "inactive") {
    where.push("po.is_active = 0");
  }
  if (filters.modality === "online") {
    where.push("po.delivery = 'ONLINE'");
  }
  if (filters.modality === "mixta") {
    where.push("po.delivery = 'CAMPUS' AND po.ejecutivo = 1");
  }
  if (filters.modality === "presencial") {
    where.push("po.delivery = 'CAMPUS' AND po.escolarizado = 1");
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const joins = `
    FROM program_offering po
    INNER JOIN campus c ON c.id = po.campus_id
    INNER JOIN program p ON p.id = po.program_id`;

  const count = await db
    .prepare(`SELECT COUNT(*) AS total ${joins} ${whereSql}`)
    .bind(...params)
    .first<CountRow>();

  const offset = Math.max(0, (filters.page - 1) * filters.pageSize);
  const rows = await db
    .prepare(
      `SELECT
        po.id, po.cycle, po.track, po.delivery, po.escolarizado, po.ejecutivo,
        po.pricing_plans, po.module_count, po.subjects_by_module,
        po.line_of_business, po.is_active, po.archived_at, po.archive_reason,
        po.updated_by, po.created_at, po.updated_at,
        c.id AS campus_id, c.code AS campus_code, c.name AS campus_name,
        c.meta_key AS campus_meta_key, c.tier AS campus_tier, c.kind AS campus_kind,
        p.id AS program_id, p.name AS program_name,
        p.business_line AS program_business_line, p.level AS program_level,
        p.category AS program_category
      ${joins}
      ${whereSql}
      ORDER BY po.cycle DESC, po.updated_at DESC, po.id ASC
      LIMIT ? OFFSET ?`,
    )
    .bind(...params, filters.pageSize, offset)
    .all<OfferRow>();

  return {
    total: Number(count?.total ?? 0),
    offers: (rows.results ?? []).map(mapOffer),
  };
}

// Keeps JSON parsing centralized for callers that need to inspect the raw
// subjects metadata while preserving a safe fallback.
export function parseSubjectsByModule(value: string | null): Record<string, unknown> {
  return parseJsonObject(value);
}
