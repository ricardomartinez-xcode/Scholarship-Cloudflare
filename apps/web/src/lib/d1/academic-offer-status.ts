import type { AppD1Database } from "./contracts";
import { writeAuditEvent } from "./audit";
import { nowIso } from "./ids";

export interface D1AcademicOfferStatus {
  id: string;
  isActive: boolean;
  archivedAt: string | null;
  archivedReason: string | null;
  updatedBy: string | null;
  updatedAt: string;
  cycle: string;
}

interface AcademicOfferStatusRow {
  id: string;
  is_active: number | boolean;
  archived_at: string | null;
  archived_reason: string | null;
  updated_by: string | null;
  updated_at: string;
  cycle: string;
}

function mapStatus(row: AcademicOfferStatusRow): D1AcademicOfferStatus {
  return {
    id: row.id,
    isActive: row.is_active === 1 || row.is_active === true,
    archivedAt: row.archived_at,
    archivedReason: row.archived_reason,
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
    cycle: row.cycle,
  };
}

export async function findD1AcademicOfferStatus(
  db: AppD1Database,
  id: string,
): Promise<D1AcademicOfferStatus | null> {
  const row = await db
    .prepare(
      `SELECT id, is_active, archived_at, archived_reason, updated_by, updated_at, cycle
       FROM program_offering
       WHERE id = ?
       LIMIT 1`,
    )
    .bind(id)
    .first<AcademicOfferStatusRow>();

  return row ? mapStatus(row) : null;
}

export type SetD1AcademicOfferStatusResult =
  | { ok: true; offer: D1AcademicOfferStatus; changed: boolean }
  | { ok: false; reason: "not_found" };

/**
 * Changes only the availability state of an offering. The row is read again
 * after the write, so callers return the D1 source of truth rather than a
 * reconstructed payload. Re-enabling an offer deliberately clears archive
 * metadata; disabling it preserves the existing archive timestamp on retries.
 */
export async function setD1AcademicOfferStatus(
  db: AppD1Database,
  input: {
    id: string;
    isActive: boolean;
    reason: string | null;
    actorUserId: string;
    actorEmail: string;
    requestId?: string | null;
  },
): Promise<SetD1AcademicOfferStatusResult> {
  const current = await findD1AcademicOfferStatus(db, input.id);
  if (!current) return { ok: false, reason: "not_found" };

  const archivedReason = input.isActive ? null : input.reason ?? "ADMIN_STATUS_CHANGE";
  const archivedAt = input.isActive
    ? null
    : current.archivedAt ?? nowIso();

  const unchanged =
    current.isActive === input.isActive &&
    current.archivedAt === archivedAt &&
    current.archivedReason === archivedReason;

  if (unchanged) {
    return { ok: true, offer: current, changed: false };
  }

  const updatedAt = nowIso();
  await db
    .prepare(
      `UPDATE program_offering
       SET is_active = ?,
           archived_at = ?,
           archived_reason = ?,
           updated_by = ?,
           updated_at = ?
       WHERE id = ?`,
    )
    .bind(
      input.isActive ? 1 : 0,
      archivedAt,
      archivedReason,
      input.actorEmail,
      updatedAt,
      input.id,
    )
    .run();

  const offer = await findD1AcademicOfferStatus(db, input.id);
  if (!offer) return { ok: false, reason: "not_found" };

  await writeAuditEvent(db, {
    actorUserId: input.actorUserId,
    action: "academic_offer.status_updated",
    resourceType: "program_offering",
    resourceId: input.id,
    requestId: input.requestId ?? null,
    before: {
      isActive: current.isActive,
      archivedAt: current.archivedAt,
      archivedReason: current.archivedReason,
    },
    after: {
      isActive: offer.isActive,
      archivedAt: offer.archivedAt,
      archivedReason: offer.archivedReason,
    },
    metadata: { cycle: offer.cycle },
  });

  return { ok: true, offer, changed: true };
}
