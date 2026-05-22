import { AdminUiModule, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type AdminUiPreferenceState = Record<string, Prisma.JsonValue>;

export async function getAdminUiPreferenceState(
  userId: string,
  module: AdminUiModule,
): Promise<AdminUiPreferenceState> {
  const preference = await prisma.adminUiPreference.findUnique({
    where: {
      userId_module: {
        userId,
        module,
      },
    },
    select: { state: true },
  });

  if (!preference || typeof preference.state !== "object" || !preference.state) {
    return {};
  }

  return preference.state as AdminUiPreferenceState;
}

export async function upsertAdminUiPreferenceState(params: {
  userId: string;
  module: AdminUiModule;
  state: AdminUiPreferenceState;
}) {
  return prisma.adminUiPreference.upsert({
    where: {
      userId_module: {
        userId: params.userId,
        module: params.module,
      },
    },
    update: { state: params.state as Prisma.InputJsonValue },
    create: {
      userId: params.userId,
      module: params.module,
      state: params.state as Prisma.InputJsonValue,
    },
  });
}
