import {
  AdminAuditAction,
  AdminChangeSource,
  AdminConfigModule,
  Prisma,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";

type JsonInput = Prisma.InputJsonValue | null | undefined;

type AdminAuditActor = {
  id?: string | null;
  email?: string | null;
};

export type AdminAuditWriteParams = {
  module: AdminConfigModule;
  action: AdminAuditAction;
  source?: AdminChangeSource;
  actor?: AdminAuditActor;
  entityType?: string | null;
  entityId?: string | null;
  requestId?: string | null;
  before?: JsonInput;
  after?: JsonInput;
  diffSummary?: JsonInput;
  message?: string | null;
  importSessionId?: string | null;
  versionId?: string | null;
};

function toOptionalJson(value: JsonInput) {
  if (value === undefined) return undefined;
  return value === null ? Prisma.JsonNull : value;
}

export async function writeAdminAuditLog(params: AdminAuditWriteParams) {
  return prisma.adminAuditLog.create({
    data: {
      module: params.module,
      action: params.action,
      source: params.source ?? AdminChangeSource.UI,
      actorUserId: params.actor?.id ?? null,
      actorEmail: params.actor?.email ?? null,
      entityType: params.entityType ?? null,
      entityId: params.entityId ?? null,
      requestId: params.requestId ?? null,
      beforeJson: toOptionalJson(params.before),
      afterJson: toOptionalJson(params.after),
      diffSummary: toOptionalJson(params.diffSummary),
      message: params.message ?? null,
      importSessionId: params.importSessionId ?? null,
      versionId: params.versionId ?? null,
    },
  });
}

export async function listAdminAuditLog(options?: {
  module?: AdminConfigModule;
  limit?: number;
}) {
  return prisma.adminAuditLog.findMany({
    where: options?.module ? { module: options.module } : undefined,
    orderBy: [{ createdAt: "desc" }],
    take: options?.limit ?? 100,
  });
}
