export type SystemRole = "owner" | "admin_operativo" | "editor_operativo" | "user";

export const SYSTEM_ROLE_META = {
  owner: {
    label: "Owner",
    description: "Control total del sistema, incluyendo configuracion sensible y modulos tecnicos.",
  },
  admin_operativo: {
    label: "Admin Operativo",
    description: "Opera el negocio y gestiona contenido sin privilegios globales de seguridad.",
  },
  editor_operativo: {
    label: "Editor Operativo",
    description: "Edita contenido operativo y consulta reportes sin control administrativo global.",
  },
  user: {
    label: "Usuario",
    description: "Usuario general sin capacidades administrativas por defecto.",
  },
} as const satisfies Record<SystemRole, { label: string; description: string }>;

export const SYSTEM_ROLES = Object.keys(SYSTEM_ROLE_META) as SystemRole[];

export function getSystemRoleMeta(role: SystemRole) {
  return SYSTEM_ROLE_META[role];
}
