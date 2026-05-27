import { createHash } from "node:crypto";

import {
  AdminAuditAction,
  AdminChangeSource,
  AdminConfigModule,
  AdminImportSessionStatus,
  Prisma,
} from "@prisma/client";

import { writeAdminAuditLog } from "@/lib/admin-audit";
import {
  captureDraftConfigSnapshot,
  type AdminConfigSnapshot,
} from "@/lib/admin-config-snapshots";
import { prisma } from "@/lib/prisma";

export type ImportSessionActor = {
  id?: string | null;
  email?: string | null;
};

export type AdminImportSessionSerialized = {
  id: string;
  module: AdminConfigModule;
  status: AdminImportSessionStatus;
  source: AdminChangeSource;
  fileName: string | null;
  fileChecksum: string | null;
  preview: Prisma.JsonValue | null;
  payload: Prisma.JsonValue | null;
  warnings: Prisma.JsonValue | null;
  errors: Prisma.JsonValue | null;
  result: Prisma.JsonValue | null;
  beforeSnapshot: Prisma.JsonValue | null;
  afterSnapshot: Prisma.JsonValue | null;
  summary: Prisma.JsonValue | null;
  createdByEmail: string | null;
  appliedByEmail: string | null;
  appliedVersionId: string | null;
  rolledBackVersionId: string | null;
  createdAt: string;
  updatedAt: string;
  appliedAt: string | null;
  rolledBackAt: string | null;
};

export type CreateAdminImportPreviewSessionInput = {
  module: AdminConfigModule;
  actor: ImportSessionActor;
  kind?: string;
  fileName?: string | null;
  fileText?: string | null;
  fileChecksum?: string | null;
  preview?: unknown;
  payload?: unknown;
  warnings?: unknown;
  errors?: unknown;
  summary?: unknown;
  beforeSnapshot?: AdminConfigSnapshot | null;
  requestId?: string | null;
  source?: AdminChangeSource;
  captureBeforeSnapshot?: boolean;
};

export type MarkAdminImportSessionAppliedInput = {
  sessionId: string;
  module: AdminConfigModule;
  actor: ImportSessionActor;
  result?: unknown;
  afterSnapshot?: AdminConfigSnapshot | null;
  appliedVersionId?: string | null;
  requestId?: string | null;
  source?: AdminChangeSource;
  captureAfterSnapshot?: boolean;
};

export type MarkAdminImportSessionFailedInput = {
  sessionId: string;
  module: AdminConfigModule;
  actor?: ImportSessionActor | null;
  errors?: unknown;
  result?: unknown;
  requestId?: string | null;
  source?: AdminChangeSource;
};

export type MarkAdminImportSessionRolledBackInput = {
  sessionId: string;
  module: AdminConfigModule;
  actor: ImportSessionActor;
  result?: unknown;
  rolledBackVersionId?: string | null;
  requestId?: string | null;
  source?: AdminChangeSource;
};

const IMPORT_SESSION_SELECT = {
  id: true,
  module: true,
  status: true,
  source: true,
  fileName: true,
  fileChecksum: true,
  preview: true,
  payload: true,
  warnings: true,
  errors: true,
  result: true,
  beforeSnapshot: true,
  afterSnapshot: true,
  summary: true,
  createdByEmail: true,
  appliedByEmail: true,
  appliedVersionId: true,
  rolledBackVersionId: true,
  createdAt: true,
  updatedAt: true,
  appliedAt: true,
  rolledBackAt: true,
} satisfies Prisma.AdminImportSessionSelect;

type ImportSessionRecord = Prisma.AdminImportSessionGetPayload<{
  select: typeof IMPORT_SESSION_SELECT;
}>;

const SNAPSHOT_IMPORT_MODULES = new Set<AdminConfigModule>([
  AdminConfigModule.BENEFITS,
  AdminConfigModule.PRICES,
  AdminConfigModule.CTAS,
  AdminConfigModule.SIDEBAR,
  AdminConfigModule.DIRECTORY,
  AdminConfigModule.OFFER,
]);

function toNullableJson(value: unknown): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
  if (value === undefined || value === null) return Prisma.JsonNull;
  return value as Prisma.InputJsonValue;
}

function serializeImportSession(session: ImportSessionRecord): AdminImportSessionSerialized {
  return {
    id: session.id,
    module: session.module,
    status: session.status,
    source: session.source,
    fileName: session.fileName,
    fileChecksum: session.fileChecksum,
    preview: session.preview,
    payload: session.payload,
    warnings: session.warnings,
    errors: session.errors,
    result: session.result,
    beforeSnapshot: session.beforeSnapshot,
    afterSnapshot: session.afterSnapshot,
    summary: session.summary,
    createdByEmail: session.createdByEmail,
    appliedByEmail: session.appliedByEmail,
    appliedVersionId: session.appliedVersionId,
    rolledBackVersionId: session.rolledBackVersionId,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
    appliedAt: session.appliedAt?.toISOString() ?? null,
    rolledBackAt: session.rolledBackAt?.toISOString() ?? null,
  };
}

export function createImportFileChecksum(input: string | Buffer | Uint8Array | ArrayBuffer) {
  const hash = createHash("sha256");
  if (typeof input === "string") {
    hash.update(input, "utf8");
  } else if (Buffer.isBuffer(input)) {
    hash.update(input);
  } else {
    hash.update(Buffer.from(input as ArrayBuffer));
  }
  return hash.digest("hex");
}

export function buildImportFileName(kind: string, fileName?: string | null) {
  const normalizedKind = String(kind || "import").trim() || "import";
  const normalizedName = String(fileName ?? "").trim();
  return normalizedName ? `${normalizedKind}:${normalizedName}` : normalizedKind;
}

export function isConfigSnapshotImportModule(module: AdminConfigModule) {
  return SNAPSHOT_IMPORT_MODULES.has(module);
}

export async function captureImportModuleSnapshot(module: AdminConfigModule) {
  if (!isConfigSnapshotImportModule(module)) return null;
  return captureDraftConfigSnapshot(module);
}

function hasJsonErrors(value: unknown) {
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === "object") return Object.keys(value).length > 0;
  return Boolean(value);
}

export function assertImportSessionCanApply(session: {
  status: AdminImportSessionStatus | string;
  errors?: unknown;
}) {
  if (session.status !== AdminImportSessionStatus.preview) {
    throw new Error("La sesión de importación ya no está en estado preview.");
  }
  if (hasJsonErrors(session.errors)) {
    throw new Error("La sesión de importación contiene errores de validación.");
  }
}

export async function createAdminImportPreviewSession(input: CreateAdminImportPreviewSessionInput) {
  const source = input.source ?? AdminChangeSource.IMPORT;
  const beforeSnapshot =
    input.beforeSnapshot !== undefined
      ? input.beforeSnapshot
      : input.captureBeforeSnapshot === false
        ? null
        : await captureImportModuleSnapshot(input.module);
  const fileChecksum =
    input.fileChecksum ??
    (input.fileText !== undefined && input.fileText !== null
      ? createImportFileChecksum(input.fileText)
      : null);

  const session = await prisma.adminImportSession.create({
    data: {
      module: input.module,
      status: AdminImportSessionStatus.preview,
      source,
      fileName: buildImportFileName(input.kind ?? "import", input.fileName),
      fileChecksum,
      preview: toNullableJson(input.preview),
      payload: toNullableJson(input.payload),
      warnings: toNullableJson(input.warnings),
      errors: toNullableJson(input.errors),
      summary: toNullableJson(input.summary),
      beforeSnapshot: toNullableJson(beforeSnapshot),
      createdByUserId: input.actor.id ?? null,
      createdByEmail: input.actor.email ?? null,
    },
    select: IMPORT_SESSION_SELECT,
  });

  await writeAdminAuditLog({
    module: input.module,
    action: AdminAuditAction.IMPORT_VALIDATE,
    source,
    actor: input.actor,
    entityType: "AdminImportSession",
    entityId: session.id,
    requestId: input.requestId ?? null,
    before: beforeSnapshot as Prisma.InputJsonValue | null,
    after: {
      sessionId: session.id,
      status: session.status,
      summary: input.summary ?? null,
    },
    diffSummary: (input.summary ?? null) as Prisma.InputJsonValue | null,
    importSessionId: session.id,
  });

  return serializeImportSession(session);
}

export async function getAdminImportSession(params: { sessionId: string }) {
  const session = await prisma.adminImportSession.findUnique({
    where: { id: params.sessionId },
    select: IMPORT_SESSION_SELECT,
  });
  return session ? serializeImportSession(session) : null;
}

export async function listAdminImportSessions(params?: {
  module?: AdminConfigModule | null;
  status?: AdminImportSessionStatus | null;
  limit?: number | null;
}) {
  const take = Math.min(Math.max(Math.trunc(params?.limit ?? 30), 1), 100);
  const rows = await prisma.adminImportSession.findMany({
    where: {
      ...(params?.module ? { module: params.module } : {}),
      ...(params?.status ? { status: params.status } : {}),
    },
    orderBy: [{ createdAt: "desc" }],
    take,
    select: IMPORT_SESSION_SELECT,
  });
  return rows.map(serializeImportSession);
}

export async function markAdminImportSessionApplied(input: MarkAdminImportSessionAppliedInput) {
  const source = input.source ?? AdminChangeSource.IMPORT;
  const afterSnapshot =
    input.afterSnapshot !== undefined
      ? input.afterSnapshot
      : input.captureAfterSnapshot === false
        ? null
        : await captureImportModuleSnapshot(input.module);

  const session = await prisma.adminImportSession.update({
    where: { id: input.sessionId },
    data: {
      status: AdminImportSessionStatus.applied,
      result: toNullableJson(input.result),
      afterSnapshot: toNullableJson(afterSnapshot),
      appliedAt: new Date(),
      appliedByUserId: input.actor.id ?? null,
      appliedByEmail: input.actor.email ?? null,
      appliedVersionId: input.appliedVersionId ?? null,
    },
    select: IMPORT_SESSION_SELECT,
  });

  await writeAdminAuditLog({
    module: input.module,
    action: AdminAuditAction.IMPORT_APPLY,
    source,
    actor: input.actor,
    entityType: "AdminImportSession",
    entityId: session.id,
    requestId: input.requestId ?? null,
    after: {
      sessionId: session.id,
      status: session.status,
      result: input.result ?? null,
    },
    diffSummary: (input.result ?? null) as Prisma.InputJsonValue | null,
    importSessionId: session.id,
    versionId: input.appliedVersionId ?? null,
  });

  return serializeImportSession(session);
}

export async function markAdminImportSessionFailed(input: MarkAdminImportSessionFailedInput) {
  const source = input.source ?? AdminChangeSource.IMPORT;
  const session = await prisma.adminImportSession.update({
    where: { id: input.sessionId },
    data: {
      status: AdminImportSessionStatus.failed,
      errors: toNullableJson(input.errors),
      result: toNullableJson(input.result),
    },
    select: IMPORT_SESSION_SELECT,
  });

  await writeAdminAuditLog({
    module: input.module,
    action: AdminAuditAction.IMPORT_VALIDATE,
    source,
    actor: input.actor ?? undefined,
    entityType: "AdminImportSession",
    entityId: session.id,
    requestId: input.requestId ?? null,
    after: {
      sessionId: session.id,
      status: session.status,
      errors: input.errors ?? null,
      result: input.result ?? null,
    },
    importSessionId: session.id,
  });

  return serializeImportSession(session);
}

export async function markAdminImportSessionRolledBack(input: MarkAdminImportSessionRolledBackInput) {
  const source = input.source ?? AdminChangeSource.IMPORT;
  const session = await prisma.adminImportSession.update({
    where: { id: input.sessionId },
    data: {
      status: AdminImportSessionStatus.rolled_back,
      result: toNullableJson(input.result),
      rolledBackAt: new Date(),
      rolledBackVersionId: input.rolledBackVersionId ?? null,
    },
    select: IMPORT_SESSION_SELECT,
  });

  await writeAdminAuditLog({
    module: input.module,
    action: AdminAuditAction.IMPORT_ROLLBACK,
    source,
    actor: input.actor,
    entityType: "AdminImportSession",
    entityId: session.id,
    requestId: input.requestId ?? null,
    after: {
      sessionId: session.id,
      status: session.status,
      result: input.result ?? null,
    },
    importSessionId: session.id,
    versionId: input.rolledBackVersionId ?? null,
  });

  return serializeImportSession(session);
}
