import { prisma } from "@/lib/prisma";
import { type RoleplayBotId } from "@/lib/sales-roleplay-bots";

export function getRoleplayBotEmail(botId: RoleplayBotId) {
  return `roleplay-bot-${botId}@system.relead.local`;
}

export async function ensureRoleplayBotUser(botId: RoleplayBotId, displayName: string) {
  const email = getRoleplayBotEmail(botId);
  return prisma.user.upsert({
    where: { email },
    update: {
      displayName,
      isActive: true,
    },
    create: {
      authUserId: `system-roleplay-bot-${botId}`,
      email,
      displayName,
      isActive: true,
    },
  });
}
