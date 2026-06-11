import type { PrismaClient } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { parseDirectoryContactMethods } from "@/lib/directory-contact-methods";

type DirectoryContactMethodClient = Pick<PrismaClient, "directoryContactMethod">;

function serializeMethods(
  methods: Array<{
    type: string;
    value: string;
    normalizedValue: string;
    isPrimary: boolean;
    sortOrder: number;
  }>,
) {
  return methods
    .map((method) =>
      [
        method.type,
        method.value,
        method.normalizedValue,
        method.isPrimary ? 1 : 0,
        method.sortOrder,
      ].join("|"),
    )
    .join("||");
}

export async function syncDirectoryContactMethods(
  directoryContactId: string,
  rawContact: string | null | undefined,
  client?: DirectoryContactMethodClient,
) {
  const db = (client ?? prisma) as DirectoryContactMethodClient;
  const parsed = parseDirectoryContactMethods(rawContact);
  const existing = await db.directoryContactMethod.findMany({
    where: { directoryContactId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      type: true,
      value: true,
      normalizedValue: true,
      isPrimary: true,
      sortOrder: true,
    },
  });

  if (serializeMethods(existing) === serializeMethods(parsed)) {
    return { status: "skipped" as const, parsed };
  }

  await db.directoryContactMethod.deleteMany({
    where: { directoryContactId },
  });

  if (parsed.length > 0) {
    await db.directoryContactMethod.createMany({
      data: parsed.map((method) => ({
        directoryContactId,
        type: method.type,
        value: method.value,
        normalizedValue: method.normalizedValue,
        isPrimary: method.isPrimary,
        sortOrder: method.sortOrder,
      })),
    });
  }

  return {
    status: existing.length ? ("updated" as const) : ("created" as const),
    parsed,
  };
}
