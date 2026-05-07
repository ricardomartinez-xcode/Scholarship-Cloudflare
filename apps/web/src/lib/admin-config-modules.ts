import { AdminConfigModule } from "@prisma/client";

import { normalizeEmail } from "@/lib/normalize";

export const ADMIN_CONFIG_MODULE_META = {
  [AdminConfigModule.ACCESS]: {
    label: "Accesos",
    description: "Permisos finos, membresias y capacidades efectivas del admin.",
    revalidatePaths: ["/admin/users", "/admin/invitations", "/admin/organizations", "/admin"],
  },
  [AdminConfigModule.BENEFITS]: {
    label: "Beneficios",
    description: "Beneficios adicionales configurables para la calculadora.",
    revalidatePaths: ["/admin/benefits", "/", "/unidep"],
  },
  [AdminConfigModule.PRICES]: {
    label: "Precios",
    description: "Overrides de precio usados por la calculadora.",
    revalidatePaths: ["/admin/prices", "/", "/unidep"],
  },
  [AdminConfigModule.CTAS]: {
    label: "CTAs",
    description: "Botones y mensajes configurables para home, app y admin.",
    revalidatePaths: ["/admin/ctas", "/", "/unidep", "/admin"],
  },
  [AdminConfigModule.SIDEBAR]: {
    label: "Información pública",
    description: "Contacto, horarios y datos visibles en el rail público.",
    revalidatePaths: ["/admin/sidebar", "/"],
  },
  [AdminConfigModule.DIRECTORY]: {
    label: "Directorio",
    description: "Contactos públicos del directorio UNIDEP.",
    revalidatePaths: ["/admin/unidep/directory", "/api/public/directorio", "/unidep"],
  },
  [AdminConfigModule.OFFER]: {
    label: "Oferta académica",
    description: "Programas y ofertas activas del ciclo de importación.",
    revalidatePaths: ["/admin/oferta", "/api/public/oferta", "/unidep"],
  },
} as const satisfies Record<
  AdminConfigModule,
  { label: string; description: string; revalidatePaths: string[] }
>;

export function getAdminConfigModuleMeta(module: AdminConfigModule) {
  return ADMIN_CONFIG_MODULE_META[module];
}

export function getAdminConfigModulePaths(module: AdminConfigModule) {
  return ADMIN_CONFIG_MODULE_META[module].revalidatePaths;
}

function getExplicitPublisherEmails() {
  const raw = process.env.ADMIN_PUBLISH_EMAILS ?? process.env.REQUIRE_PUBLISH_EMAILS ?? "";
  return raw
    .split(",")
    .map((value) => normalizeEmail(value))
    .filter(Boolean);
}

export function canPublishAdminConfig(email?: string | null) {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  return getExplicitPublisherEmails().includes(normalized);
}
