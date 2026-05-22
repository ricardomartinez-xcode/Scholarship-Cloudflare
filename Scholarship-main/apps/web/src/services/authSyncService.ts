import { Role } from "@prisma/client";

import { getSql } from "@/lib/neon";
import { prisma } from "@/lib/prisma";

export type SyncSeverity = "low" | "medium" | "high" | "critical";

export type NeonAuthUser = {
  id: string;
  email: string | null;
  name: string | null;
  createdAt: string | null;
};

export type AppUserSnapshot = {
  id: string;
  email: string;
  role: Role;
  isActive: boolean;
  authUserId: string | null;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
};

export type AppOrphanRecord = {
  user: AppUserSnapshot;
  reason: "missing_auth_user_id" | "auth_reference_not_found";
  severity: SyncSeverity;
};

export type AuthReferenceRecord = {
  user: AppUserSnapshot;
  neonId: string;
  neonEmail: string | null;
};

export type BrokenAuthReferenceRecord = {
  user: AppUserSnapshot;
  suggestedNeonId: string | null;
  suggestedNeonEmail: string | null;
};

export type NeonDuplicateEmailRecord = {
  email: string;
  count: number;
  neonIds: string[];
};

export type AuthSyncDiagnostics = {
  generatedAt: string;
  neonAuthAvailable: boolean;
  neonAuthWarning: string | null;
  warnings: string[];
  appUsers: AppUserSnapshot[];
  neonUsers: NeonAuthUser[];
  neonOnly: NeonAuthUser[];
  appOrphans: AppOrphanRecord[];
  missingAuthUserIdMatches: AuthReferenceRecord[];
  brokenAuthReferences: BrokenAuthReferenceRecord[];
  mismatchedEmailByAuthUserId: AuthReferenceRecord[];
  duplicateNeonEmails: NeonDuplicateEmailRecord[];
  privilegedOrphans: AppOrphanRecord[];
  summary: {
    appUsersTotal: number;
    appUsersAnalyzed: number;
    neonUsersTotal: number | null;
    neonUsersAnalyzed: number;
    neonOnlyCount: number;
    appOrphansCount: number;
    missingAuthUserIdMatchesCount: number;
    brokenAuthReferencesCount: number;
    mismatchedEmailByAuthUserIdCount: number;
    duplicateNeonEmailsCount: number;
    privilegedOrphansCount: number;
  };
};

type NeonCountRow = { count: number | string };
type NeonUserRow = {
  id: string;
  email: string | null;
  name: string | null;
  created_at: string | Date | null;
};

function clampLimit(limit: number | undefined, fallback = 2500) {
  const value = Number(limit ?? fallback);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(Math.max(Math.trunc(value), 200), 10000);
}

function normalizeEmail(value: string | null | undefined) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized || null;
}

function describeDbError(error: unknown) {
  const err = error as { message?: string; code?: string; hint?: string };
  const chunks: string[] = [];
  if (err?.code) chunks.push(`code=${err.code}`);
  if (err?.message) chunks.push(err.message);
  if (err?.hint) chunks.push(`hint=${err.hint}`);
  return chunks.join(" · ") || String(error);
}

function toIso(value: Date | string | null | undefined) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString();
}

function toAppSnapshot(user: {
  id: string;
  email: string;
  role: Role;
  isActive: boolean;
  authUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
}): AppUserSnapshot {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    authUserId: user.authUserId,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
  };
}

function buildNeonByEmailMap(neonUsers: NeonAuthUser[]) {
  const map = new Map<string, NeonAuthUser[]>();
  for (const neonUser of neonUsers) {
    const email = normalizeEmail(neonUser.email);
    if (!email) continue;
    const current = map.get(email) ?? [];
    current.push(neonUser);
    map.set(email, current);
  }
  return map;
}

export async function getAuthSyncDiagnostics(options?: {
  analysisLimit?: number;
}): Promise<AuthSyncDiagnostics> {
  const analysisLimit = clampLimit(options?.analysisLimit);
  const warnings: string[] = [];

  const [appUsersTotal, appUsersRaw] = await Promise.all([
    prisma.user.count(),
    prisma.user.findMany({
      orderBy: [{ createdAt: "desc" }],
      take: analysisLimit,
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        authUserId: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true,
      },
    }),
  ]);
  if (appUsersTotal > analysisLimit) {
    warnings.push(
      `El diagnóstico analizó ${analysisLimit} de ${appUsersTotal} usuarios de app. Ajusta analysisLimit para una cobertura completa.`,
    );
  }

  const appUsers = appUsersRaw.map(toAppSnapshot);
  const appByAuthUserId = new Map<string, AppUserSnapshot>();
  for (const user of appUsers) {
    if (!user.authUserId) continue;
    appByAuthUserId.set(user.authUserId, user);
  }

  let neonAuthAvailable = true;
  let neonAuthWarning: string | null = null;
  let neonUsers: NeonAuthUser[] = [];
  let neonUsersTotal: number | null = null;

  try {
    const sql = getSql();
    const [countRows, neonRows] = await Promise.all([
      sql`SELECT COUNT(*)::int AS count FROM neon_auth."user"`,
      sql`
        SELECT
          n.id::text AS id,
          n.email,
          n.name,
          n."createdAt" AS created_at
        FROM neon_auth."user" n
        ORDER BY n."createdAt" DESC
        LIMIT ${analysisLimit}
      `,
    ]);
    neonUsersTotal = Number((countRows as NeonCountRow[])[0]?.count ?? 0);
    neonUsers = (neonRows as NeonUserRow[]).map((row) => ({
      id: row.id,
      email: row.email,
      name: row.name,
      createdAt: toIso(row.created_at),
    }));
    if (neonUsersTotal > analysisLimit) {
      warnings.push(
        `El diagnóstico analizó ${analysisLimit} de ${neonUsersTotal} usuarios de Neon Auth.`,
      );
    }
  } catch (error) {
    neonAuthAvailable = false;
    neonAuthWarning =
      "No se pudo consultar neon_auth.user. Verifica acceso al schema neon_auth y permisos SELECT.";
    warnings.push(`${neonAuthWarning} (${describeDbError(error)})`);
  }

  const neonById = new Map(neonUsers.map((user) => [user.id, user]));
  const neonByEmail = buildNeonByEmailMap(neonUsers);

  const neonOnly =
    neonAuthAvailable
      ? neonUsers.filter((neonUser) => !appByAuthUserId.has(neonUser.id))
      : [];

  const appOrphans: AppOrphanRecord[] = appUsers
    .filter((user) => {
      if (!user.authUserId) return true;
      if (!neonAuthAvailable) return false;
      return !neonById.has(user.authUserId);
    })
    .map((user) => ({
      user,
      reason: user.authUserId ? "auth_reference_not_found" : "missing_auth_user_id",
      severity:
        user.role === Role.owner || user.role === Role.admin_operativo
          ? "critical"
          : user.isActive
            ? "high"
            : "medium",
    }));

  const missingAuthUserIdMatches: AuthReferenceRecord[] = appUsers
    .filter((user) => !user.authUserId)
    .map((user) => {
      const email = normalizeEmail(user.email);
      if (!email || !neonAuthAvailable) return null;
      const matches = neonByEmail.get(email) ?? [];
      if (matches.length !== 1) return null;
      const [match] = matches;
      if (!match) return null;
      if (appByAuthUserId.has(match.id)) return null;
      return {
        user,
        neonId: match.id,
        neonEmail: match.email,
      } satisfies AuthReferenceRecord;
    })
    .filter((item): item is AuthReferenceRecord => Boolean(item));

  const brokenAuthReferences: BrokenAuthReferenceRecord[] = appUsers
    .filter((user) => Boolean(user.authUserId))
    .map((user) => {
      if (!user.authUserId) return null;
      if (!neonAuthAvailable || neonById.has(user.authUserId)) return null;
      const email = normalizeEmail(user.email);
      const matches = email ? neonByEmail.get(email) ?? [] : [];
      const suggested = matches.length === 1 ? matches[0] : null;
      return {
        user,
        suggestedNeonId: suggested?.id ?? null,
        suggestedNeonEmail: suggested?.email ?? null,
      } satisfies BrokenAuthReferenceRecord;
    })
    .filter((item): item is BrokenAuthReferenceRecord => Boolean(item));

  const mismatchedEmailByAuthUserId: AuthReferenceRecord[] = appUsers
    .filter((user) => Boolean(user.authUserId))
    .map((user) => {
      if (!user.authUserId) return null;
      const neonUser = neonById.get(user.authUserId);
      if (!neonUser) return null;
      if (normalizeEmail(neonUser.email) === normalizeEmail(user.email)) return null;
      return {
        user,
        neonId: neonUser.id,
        neonEmail: neonUser.email,
      } satisfies AuthReferenceRecord;
    })
    .filter((item): item is AuthReferenceRecord => Boolean(item));

  const duplicateNeonEmails: NeonDuplicateEmailRecord[] = Array.from(neonByEmail.entries())
    .map(([email, rows]) => ({
      email,
      count: rows.length,
      neonIds: rows.map((row) => row.id),
    }))
    .filter((record) => record.count > 1)
    .sort((left, right) => right.count - left.count || left.email.localeCompare(right.email, "es"));

  const privilegedOrphans = appOrphans.filter(
    (record) =>
      record.user.isActive &&
      (record.user.role === Role.owner || record.user.role === Role.admin_operativo),
  );

  return {
    generatedAt: new Date().toISOString(),
    neonAuthAvailable,
    neonAuthWarning,
    warnings,
    appUsers,
    neonUsers,
    neonOnly,
    appOrphans,
    missingAuthUserIdMatches,
    brokenAuthReferences,
    mismatchedEmailByAuthUserId,
    duplicateNeonEmails,
    privilegedOrphans,
    summary: {
      appUsersTotal,
      appUsersAnalyzed: appUsers.length,
      neonUsersTotal,
      neonUsersAnalyzed: neonUsers.length,
      neonOnlyCount: neonOnly.length,
      appOrphansCount: appOrphans.length,
      missingAuthUserIdMatchesCount: missingAuthUserIdMatches.length,
      brokenAuthReferencesCount: brokenAuthReferences.length,
      mismatchedEmailByAuthUserIdCount: mismatchedEmailByAuthUserId.length,
      duplicateNeonEmailsCount: duplicateNeonEmails.length,
      privilegedOrphansCount: privilegedOrphans.length,
    },
  };
}
