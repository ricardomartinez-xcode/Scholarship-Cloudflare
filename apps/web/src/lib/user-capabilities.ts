import { Role, UserCapability } from "@prisma/client";

import { prisma } from "@/lib/prisma";

const USER_CAPABILITY_META_ALL = {
  [UserCapability.access_admin_cta]: {
    label: "Acceso a CTAs de admin",
    description: "Muestra CTAs reservados para usuarios con acceso especial.",
  },
  [UserCapability.user_vip]: {
    label: "Usuario VIP",
    description: "Muestra CTAs y contenido exclusivo para usuarios VIP.",
  },
  [UserCapability.view_audit]: {
    label: "Ver auditoría",
    description: "Permite consultar registros de auditoría desde la aplicación.",
  },
  [UserCapability.manage_templates]: {
    label: "Gestionar plantillas",
    description: "Permite crear y editar plantillas de WhatsApp y comunicaciones.",
  },
  [UserCapability.manage_communications]: {
    label: "Gestionar comunicaciones",
    description: "Permite publicar y administrar comunicados en la plataforma.",
  },
  [UserCapability.owner_permissions]: {
    label: "Permisos de propietario",
    description: "Nivel máximo de permisos para usuarios no administradores.",
  },
} as const satisfies Record<UserCapability, { label: string; description: string }>;

export const USER_CAPABILITY_META = {
  ...USER_CAPABILITY_META_ALL,
} as const satisfies Record<UserCapability, { label: string; description: string }>;

export const USER_CAPABILITIES = [
  UserCapability.access_admin_cta,
  UserCapability.user_vip,
] as UserCapability[];
const USER_CAPABILITY_VALUES = Object.values(UserCapability) as UserCapability[];
export const ALL_USER_CAPABILITIES = [...USER_CAPABILITY_VALUES];

export const INTERNAL_USER_CAPABILITIES = USER_CAPABILITY_VALUES.filter(
  (capability) => !USER_CAPABILITIES.includes(capability),
);

export function getUserCapabilityMeta(capability: UserCapability) {
  return USER_CAPABILITY_META_ALL[capability];
}

export function isUserCapability(value: string): value is UserCapability {
  return USER_CAPABILITY_VALUES.includes(value as UserCapability);
}

export function isVisualUserCapability(capability: UserCapability) {
  return USER_CAPABILITIES.includes(capability);
}

export async function getUserCapabilitySet(userId: string): Promise<Set<UserCapability>> {
  try {
    const [user, rows] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      }),
      prisma.userCapabilityAssignment.findMany({
        where: { userId },
        select: { capability: true },
      }),
    ]);
    if (user?.role === Role.owner) {
      return new Set(ALL_USER_CAPABILITIES);
    }
    return new Set(rows.map((r) => r.capability));
  } catch {
    return new Set();
  }
}
