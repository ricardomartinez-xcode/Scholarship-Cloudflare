import { AdminCapability, Role } from "@prisma/client";

export const SYSTEM_ROLE_META = {
  [Role.owner]: {
    label: "Owner",
    description: "Control total del sistema, incluyendo configuración sensible y módulos técnicos.",
  },
  [Role.admin_operativo]: {
    label: "Admin Operativo",
    description: "Opera el negocio y gestiona contenido sin privilegios globales de seguridad.",
  },
  [Role.editor_operativo]: {
    label: "Editor Operativo",
    description: "Edita contenido operativo y consulta reportes sin control administrativo global.",
  },
  [Role.user]: {
    label: "Usuario",
    description: "Usuario general sin capacidades administrativas por defecto.",
  },
} as const satisfies Record<Role, { label: string; description: string }>;

export const SYSTEM_ROLES = Object.keys(SYSTEM_ROLE_META) as Role[];

export const ALL_ADMIN_CAPABILITIES = Object.values(AdminCapability) as AdminCapability[];

const ROLE_CAPABILITY_MAP: Record<Role, AdminCapability[]> = {
  [Role.owner]: [...ALL_ADMIN_CAPABILITIES],
  [Role.admin_operativo]: [
    AdminCapability.view_admin,
    AdminCapability.view_admin_operations,
    AdminCapability.manage_benefits,
    AdminCapability.manage_prices,
    AdminCapability.manage_ctas,
    AdminCapability.manage_sidebar,
    AdminCapability.manage_offers,
    AdminCapability.manage_directory,
    AdminCapability.view_users,
    AdminCapability.view_invites,
    AdminCapability.manage_invites,
    AdminCapability.view_reports,
  ],
  [Role.editor_operativo]: [
    AdminCapability.view_admin,
    AdminCapability.view_admin_operations,
    AdminCapability.manage_ctas,
    AdminCapability.manage_sidebar,
    AdminCapability.manage_offers,
    AdminCapability.manage_directory,
    AdminCapability.view_reports,
  ],
  [Role.user]: [],
};

export function getSystemRoleCapabilities(role: Role) {
  return new Set<RoleCapability>(ROLE_CAPABILITY_MAP[role] ?? []);
}

type RoleCapability = AdminCapability;

export function isSystemOwner(role: Role) {
  return role === Role.owner;
}

export function isProtectedSystemRole(role: Role) {
  return role === Role.owner;
}

export function isOperationalAdminRole(role: Role) {
  return role === Role.owner || role === Role.admin_operativo || role === Role.editor_operativo;
}

export function getSystemRoleMeta(role: Role) {
  return SYSTEM_ROLE_META[role];
}

const ROLE_RANK: Record<Role, number> = {
  [Role.user]: 0,
  [Role.editor_operativo]: 1,
  [Role.admin_operativo]: 2,
  [Role.owner]: 3,
};

export function maxSystemRole(current: Role, next: Role) {
  return ROLE_RANK[current] >= ROLE_RANK[next] ? current : next;
}
