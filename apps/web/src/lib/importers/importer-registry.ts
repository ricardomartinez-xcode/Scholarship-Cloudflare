import { AdminConfigModule } from "@prisma/client";

import type { AdminImportTemplate } from "./admin-import-templates";

export const ADMIN_IMPORTER_KINDS = ["importer", "catalog", "asset"] as const;

export type AdminImporterKind = (typeof ADMIN_IMPORTER_KINDS)[number];

export type AdminImporterDefinition = {
  id: string;
  label: string;
  description: string;
  href: string;
  actionLabel: string;
  kind: AdminImporterKind;
  inputLabel: string;
  lifecycleLabel: string;
  templateId?: AdminImportTemplate["id"];
  module?: AdminConfigModule;
  canonicalPreviewRoute?: string;
  canonicalApplyRoute?: string;
  legacyRoutes?: readonly string[];
};

/**
 * Registro único de los destinos visibles en el Centro de importación.
 *
 * No todos los destinos son importadores de archivos. `kind` evita que la UI
 * presente un catálogo o una pantalla de administración como si soportara el
 * mismo ciclo de preview, apply, publish y rollback.
 */
export const ADMIN_IMPORTER_REGISTRY = [
  {
    id: "prices",
    label: "Precio lista",
    description:
      "Carga precios por alcance, programa, línea, modalidad, plan, módulo y tier normalizados.",
    href: "/admin/prices?panel=imports",
    actionLabel: "Importar precios",
    kind: "importer",
    inputLabel: "CSV / XLSX",
    lifecycleLabel: "Preview, sesión y publicación",
    templateId: "prices",
    module: AdminConfigModule.PRICES,
  },
  {
    id: "benefits",
    label: "Beneficios adicionales",
    description:
      "Carga porcentajes extra o primer pago con los mismos tipos, ingresos y estados de la captura manual.",
    href: "/admin/benefits?panel=imports",
    actionLabel: "Importar beneficios",
    kind: "importer",
    inputLabel: "CSV",
    lifecycleLabel: "Preview, sesión y publicación",
    templateId: "benefits",
    module: AdminConfigModule.BENEFITS,
  },
  {
    id: "base-scholarships",
    label: "% de beca por promedio",
    description:
      "Actualiza reglas base por promedio, línea, modalidad, plan, programa, plantel y tier.",
    href: "/admin/benefits?panel=base",
    actionLabel: "Importar becas base",
    kind: "importer",
    inputLabel: "CSV",
    lifecycleLabel: "Preview, sesión y publicación",
    templateId: "base-scholarships",
    module: AdminConfigModule.BENEFITS,
  },
  {
    id: "academic-offer",
    label: "Oferta por planteles",
    description:
      "Valida oferta activa por campus, programa, ciclo, línea, modalidad, plan, módulos y horarios.",
    href: "/admin/oferta?panel=imports",
    actionLabel: "Importar oferta",
    kind: "importer",
    inputLabel: "CSV / XLSX",
    lifecycleLabel: "Preview, sesión y publicación",
    templateId: "academic-offer",
    module: AdminConfigModule.OFFER,
    canonicalPreviewRoute: "/api/admin/import-academic-offer",
    canonicalApplyRoute: "/api/admin/import-academic-offer/:sessionId/apply",
    legacyRoutes: [
      "/api/admin/import/academic-offer",
      "/api/admin/academic-offer",
      "/api/admin/academic-offers",
    ],
  },
  {
    id: "academic-fees",
    label: "Costos académicos",
    description:
      "Carga costos base de trámites y la disponibilidad o costo particular por plantel.",
    href: "/admin/unidep/fees?tab=seed&seedMode=unified",
    actionLabel: "Importar costos",
    kind: "importer",
    inputLabel: "CSV",
    lifecycleLabel: "Validación en módulo operativo",
    templateId: "academic-fees",
  },
  {
    id: "academic-catalog",
    label: "Oferta académica",
    description:
      "Administra programas académicos, datos base y materiales asociados en catálogo.",
    href: "/admin/unidep/programas",
    actionLabel: "Administrar catálogo",
    kind: "catalog",
    inputLabel: "Catálogo / R2",
    lifecycleLabel: "Administración de catálogo",
    module: AdminConfigModule.OFFER,
  },
  {
    id: "campuses",
    label: "Planteles",
    description:
      "Actualiza datos operativos de campus, como dirección, teléfono y WhatsApp.",
    href: "/admin/unidep/campuses#importacion",
    actionLabel: "Administrar planteles",
    kind: "catalog",
    inputLabel: "CSV / XLSX",
    lifecycleLabel: "Administración de planteles",
  },
  {
    id: "aliases",
    label: "Aliases canónicos",
    description:
      "Gestiona equivalencias de línea, modalidad y programa que usan los normalizadores de importación.",
    href: "/admin/aliases",
    actionLabel: "Administrar aliases",
    kind: "catalog",
    inputLabel: "Captura manual",
    lifecycleLabel: "Normalización canónica",
  },
] as const satisfies readonly AdminImporterDefinition[];

export function listAdminImporterDefinitions(kind?: AdminImporterKind) {
  return kind
    ? ADMIN_IMPORTER_REGISTRY.filter((definition) => definition.kind === kind)
    : ADMIN_IMPORTER_REGISTRY;
}

export function getAdminImporterDefinition(id: string) {
  return ADMIN_IMPORTER_REGISTRY.find((definition) => definition.id === id) ?? null;
}

export function getAdminImporterKindLabel(kind: AdminImporterKind) {
  const labels: Record<AdminImporterKind, string> = {
    importer: "Importador",
    catalog: "Catálogo",
    asset: "Activo",
  };

  return labels[kind];
}
