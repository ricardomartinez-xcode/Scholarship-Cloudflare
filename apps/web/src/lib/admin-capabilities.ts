import { AdminCapability, AdminConfigModule, Role } from "@prisma/client";

import {
  ALL_ADMIN_CAPABILITIES,
  getSystemRoleCapabilities,
  isOperationalAdminRole,
  isSystemOwner,
} from "@/lib/system-roles";

export const ADMIN_CAPABILITY_META = {
  [AdminCapability.view_admin]: {
    label: "Ver admin",
    description: "Permite entrar al panel y consultar los modulos visibles.",
  },
  [AdminCapability.manage_benefits]: {
    label: "Beneficios",
    description: "Editar beneficios adicionales y sus reglas operativas.",
  },
  [AdminCapability.manage_prices]: {
    label: "Precios",
    description: "Editar overrides de precios y costos academicos.",
  },
  [AdminCapability.manage_ctas]: {
    label: "CTAs",
    description: "Editar CTAs, banners y mensajes configurables.",
  },
  [AdminCapability.manage_sidebar]: {
    label: "Información pública",
    description: "Editar datos visibles de contacto y apoyo en la UI pública.",
  },
  [AdminCapability.manage_offers]: {
    label: "Oferta",
    description: "Editar oferta academica y programas activos.",
  },
  [AdminCapability.manage_directory]: {
    label: "Directorio",
    description: "Editar directorio, planteles y contactos operativos.",
  },
  [AdminCapability.view_users]: {
    label: "Ver usuarios",
    description: "Consultar usuarios, membresias y permisos efectivos.",
  },
  [AdminCapability.manage_users]: {
    label: "Gestionar usuarios",
    description: "Editar usuarios, activacion y overrides de capacidades.",
  },
  [AdminCapability.view_invites]: {
    label: "Ver invitaciones",
    description: "Consultar invitaciones y su trazabilidad.",
  },
  [AdminCapability.manage_invites]: {
    label: "Gestionar invitaciones",
    description: "Crear, reenviar, cancelar o eliminar invitaciones.",
  },
  [AdminCapability.view_org_members]: {
    label: "Ver organizaciones",
    description: "Consultar organizaciones y membresias.",
  },
  [AdminCapability.manage_org_members]: {
    label: "Gestionar organizaciones",
    description: "Editar organizaciones y membresias.",
  },
  [AdminCapability.view_reports]: {
    label: "Ver reportes",
    description: "Consultar auditoria, actividad y trazabilidad.",
  },
  [AdminCapability.view_admin_operations]: {
    label: "Administración",
    description: "Permite acceder al submenu de administración operativa del panel.",
  },
  [AdminCapability.publish_config]: {
    label: "Publicar config",
    description: "Publicar o revertir configuracion versionada.",
  },
} as const satisfies Record<
  AdminCapability,
  { label: string; description: string }
>;

export const ADMIN_CAPABILITIES = Object.keys(
  ADMIN_CAPABILITY_META,
) as AdminCapability[];

export function getDefaultRoleCapabilities(role: Role) {
  return getSystemRoleCapabilities(role);
}

export function getAdminCapabilityMeta(capability: AdminCapability) {
  return ADMIN_CAPABILITY_META[capability];
}

export function resolveAdminCapabilities(
  role: Role,
  overrides: Array<{ capability: AdminCapability; enabled: boolean }>,
) {
  if (isSystemOwner(role)) {
    return new Set<AdminCapability>(ALL_ADMIN_CAPABILITIES);
  }
  const capabilities = getDefaultRoleCapabilities(role);
  for (const override of overrides) {
    if (override.enabled) capabilities.add(override.capability);
    else capabilities.delete(override.capability);
  }
  return capabilities;
}

export function hasAdminCapability(
  capabilities: Iterable<AdminCapability>,
  capability: AdminCapability,
) {
  return new Set(capabilities).has(capability);
}

export function hasAnyAdminCapability(
  capabilities: Iterable<AdminCapability>,
  required: AdminCapability[],
) {
  const set = new Set(capabilities);
  return required.some((capability) => set.has(capability));
}

export function canAccessAdminPanel(
  role: Role,
  capabilities: Iterable<AdminCapability>,
) {
  if (isOperationalAdminRole(role)) return true;
  return new Set(capabilities).has(AdminCapability.view_admin);
}

export const ADMIN_CONFIG_WRITE_CAPABILITY: Partial<
  Record<AdminConfigModule, AdminCapability>
> = {
  [AdminConfigModule.ACCESS]: AdminCapability.manage_users,
  [AdminConfigModule.BENEFITS]: AdminCapability.manage_benefits,
  [AdminConfigModule.PRICES]: AdminCapability.manage_prices,
  [AdminConfigModule.CTAS]: AdminCapability.manage_ctas,
  [AdminConfigModule.SIDEBAR]: AdminCapability.manage_sidebar,
  [AdminConfigModule.DIRECTORY]: AdminCapability.manage_directory,
  [AdminConfigModule.OFFER]: AdminCapability.manage_offers,
};

export function getAdminConfigWriteCapability(module: AdminConfigModule) {
  return ADMIN_CONFIG_WRITE_CAPABILITY[module] ?? null;
}
