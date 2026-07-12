import "server-only";

import { Role } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type SyncSeverity = "low" | "medium" | "high" | "critical";

export type SupabaseAuthUser = {
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
  supabaseId: string;
  supabaseEmail: string | null;
};

export type BrokenAuthReferenceRecord = {
  user: AppUserSnapshot;
  suggestedSupabaseId: string | null;
  suggestedSupabaseEmail: string | null;
};

export type AuthDuplicateEmailRecord = {
  email: string;
  count: number;
  supabaseIds: string[];
};

export type AuthSyncDiagnostics = {
  generatedAt: string;
  supabaseAuthAvailable: boolean;
  supabaseAuthWarning: string | null;
  warnings: string[];
  appUsers: AppUserSnapshot[];
  supabaseUsers: SupabaseAuthUser[];
  supabaseOnly: SupabaseAuthUser[];
  appOrphans: AppOrphanRecord[];
  missingAuthUserIdMatches: AuthReferenceRecord[];
  brokenAuthReferences: BrokenAuthReferenceRecord[];
  mismatchedEmailByAuthUserId: AuthReferenceRecord[];
  duplicateSupabaseEmails: AuthDuplicateEmailRecord[];
  privilegedOrphans: AppOrphanRecord[];
  summary: {
    appUsersTotal: number;
    appUsersAnalyzed: number;
    supabaseUsersTotal: number | null;
    supabaseUsersAnalyzed: number;
    supabaseOnlyCount: number;
    appOrphansCount: number;
    missingAuthUserIdMatchesCount: number;
    brokenAuthReferencesCount: number;
    mismatchedEmailByAuthUserIdCount: number;
    duplicateSupabaseEmailsCount: number;
    privilegedOrphansCount: number;
  };
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

function buildSupabaseByEmailMap(supabaseUsers: SupabaseAuthUser[]) {
  const map = new Map<string, SupabaseAuthUser[]>();
  for (const supabaseUser of supabaseUsers) {
    const email = normalizeEmail(supabaseUser.email);
    if (!email) continue;
    const current = map.get(email) ?? [];
    current.push(supabaseUser);
    map.set(email, current);
  }
  return map;
}

async function listSupabaseAuthUsers(analysisLimit: number) {
  const supabase = createSupabaseAdminClient();
  const perPage = Math.min(analysisLimit, 1000);
  const users: SupabaseAuthUser[] = [];
  let page = 1;
  let total = 0;

  while (users.length < analysisLimit) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    total = data.total;
    users.push(
      ...data.users.map((user) => {
        const metadata = user.user_metadata as Record<string, unknown> | undefined;
        const nameCandidate = metadata?.name ?? metadata?.display_name;
        return {
          id: user.id,
          email: user.email ?? null,
          name: typeof nameCandidate === "string" ? nameCandidate : null,
          createdAt: toIso(user.created_at),
        } satisfies SupabaseAuthUser;
      }),
    );

    if (!data.nextPage || data.users.length === 0) break;
    page = data.nextPage;
  }

  return { total, users: users.slice(0, analysisLimit) };
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

  let supabaseAuthAvailable = true;
  let supabaseAuthWarning: string | null = null;
  let supabaseUsers: SupabaseAuthUser[] = [];
  let supabaseUsersTotal: number | null = null;

  try {
    const result = await listSupabaseAuthUsers(analysisLimit);
    supabaseUsersTotal = result.total;
    supabaseUsers = result.users;
    if (supabaseUsersTotal > analysisLimit) {
      warnings.push(
        `El diagnóstico analizó ${analysisLimit} de ${supabaseUsersTotal} usuarios de Supabase Auth.`,
      );
    }
  } catch (error) {
    supabaseAuthAvailable = false;
    supabaseAuthWarning =
      "No se pudo consultar Supabase Auth Admin API. Verifica SUPABASE_SERVICE_ROLE_KEY.";
    warnings.push(`${supabaseAuthWarning} (${describeDbError(error)})`);
  }

  const supabaseById = new Map(supabaseUsers.map((user) => [user.id, user]));
  const supabaseByEmail = buildSupabaseByEmailMap(supabaseUsers);

  const supabaseOnly =
    supabaseAuthAvailable
      ? supabaseUsers.filter((supabaseUser) => !appByAuthUserId.has(supabaseUser.id))
      : [];

  const appOrphans: AppOrphanRecord[] = appUsers
    .filter((user) => {
      if (!user.authUserId) return true;
      if (!supabaseAuthAvailable) return false;
      return !supabaseById.has(user.authUserId);
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
      if (!email || !supabaseAuthAvailable) return null;
      const matches = supabaseByEmail.get(email) ?? [];
      if (matches.length !== 1) return null;
      const [match] = matches;
      if (!match) return null;
      if (appByAuthUserId.has(match.id)) return null;
      return {
        user,
        supabaseId: match.id,
        supabaseEmail: match.email,
      } satisfies AuthReferenceRecord;
    })
    .filter((item): item is AuthReferenceRecord => Boolean(item));

  const brokenAuthReferences: BrokenAuthReferenceRecord[] = appUsers
    .filter((user) => Boolean(user.authUserId))
    .map((user) => {
      if (!user.authUserId) return null;
      if (!supabaseAuthAvailable || supabaseById.has(user.authUserId)) return null;
      const email = normalizeEmail(user.email);
      const matches = email ? supabaseByEmail.get(email) ?? [] : [];
      const suggested = matches.length === 1 ? matches[0] : null;
      return {
        user,
        suggestedSupabaseId: suggested?.id ?? null,
        suggestedSupabaseEmail: suggested?.email ?? null,
      } satisfies BrokenAuthReferenceRecord;
    })
    .filter((item): item is BrokenAuthReferenceRecord => Boolean(item));

  const mismatchedEmailByAuthUserId: AuthReferenceRecord[] = appUsers
    .filter((user) => Boolean(user.authUserId))
    .map((user) => {
      if (!user.authUserId) return null;
      const supabaseUser = supabaseById.get(user.authUserId);
      if (!supabaseUser) return null;
      if (normalizeEmail(supabaseUser.email) === normalizeEmail(user.email)) return null;
      return {
        user,
        supabaseId: supabaseUser.id,
        supabaseEmail: supabaseUser.email,
      } satisfies AuthReferenceRecord;
    })
    .filter((item): item is AuthReferenceRecord => Boolean(item));

  const duplicateSupabaseEmails: AuthDuplicateEmailRecord[] = Array.from(supabaseByEmail.entries())
    .map(([email, rows]) => ({
      email,
      count: rows.length,
      supabaseIds: rows.map((row) => row.id),
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
    supabaseAuthAvailable,
    supabaseAuthWarning,
    warnings,
    appUsers,
    supabaseUsers,
    supabaseOnly,
    appOrphans,
    missingAuthUserIdMatches,
    brokenAuthReferences,
    mismatchedEmailByAuthUserId,
    duplicateSupabaseEmails,
    privilegedOrphans,
    summary: {
      appUsersTotal,
      appUsersAnalyzed: appUsers.length,
      supabaseUsersTotal,
      supabaseUsersAnalyzed: supabaseUsers.length,
      supabaseOnlyCount: supabaseOnly.length,
      appOrphansCount: appOrphans.length,
      missingAuthUserIdMatchesCount: missingAuthUserIdMatches.length,
      brokenAuthReferencesCount: brokenAuthReferences.length,
      mismatchedEmailByAuthUserIdCount: mismatchedEmailByAuthUserId.length,
      duplicateSupabaseEmailsCount: duplicateSupabaseEmails.length,
      privilegedOrphansCount: privilegedOrphans.length,
    },
  };
}
