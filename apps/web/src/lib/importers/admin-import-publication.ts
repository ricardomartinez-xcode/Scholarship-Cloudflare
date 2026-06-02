import {
  AdminConfigModule,
  AdminImportSessionStatus,
} from "@prisma/client";
import { NextResponse } from "next/server";

export type AdminImportPublicationStage =
  | "draft"
  | "blocked"
  | "published"
  | "rolled_back";

export type AdminImportPublicationState = {
  stage: AdminImportPublicationStage;
  label: string;
  shortLabel: string;
  description: string;
  actionLabel: string | null;
  tone: "cyan" | "emerald" | "amber" | "red" | "slate";
};

export type AdminImportPublicationConfirmationResult =
  | { ok: true }
  | { ok: false; message: string };

export function getAdminImportPublicationState(status: AdminImportSessionStatus): AdminImportPublicationState {
  if (status === AdminImportSessionStatus.preview) {
    return {
      stage: "draft",
      label: "Borrador listo para revisión",
      shortLabel: "Borrador",
      description:
        "La importación fue validada y todavía no cambia datos productivos. Revisa errores, warnings, diff y payload antes de publicar.",
      actionLabel: "Publicar importación",
      tone: "cyan",
    };
  }

  if (status === AdminImportSessionStatus.applied) {
    return {
      stage: "published",
      label: "Publicada",
      shortLabel: "Publicada",
      description:
        "La importación ya fue aplicada al módulo correspondiente y tiene resultado operativo registrado.",
      actionLabel: null,
      tone: "emerald",
    };
  }

  if (status === AdminImportSessionStatus.rolled_back) {
    return {
      stage: "rolled_back",
      label: "Publicación revertida",
      shortLabel: "Rollback",
      description:
        "La importación fue revertida desde snapshot anterior. Conserva auditoría, resultado y trazabilidad de rollback.",
      actionLabel: null,
      tone: "amber",
    };
  }

  return {
    stage: "blocked",
    label: "Borrador bloqueado",
    shortLabel: "Bloqueada",
    description:
      "La validación falló o la sesión contiene errores. Corrige el archivo y crea un nuevo borrador antes de publicar.",
    actionLabel: null,
    tone: "red",
  };
}

export async function validateAdminImportPublicationConfirmation(
  request: Request,
): Promise<AdminImportPublicationConfirmationResult> {
  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return {
      ok: false,
      message: "Para publicar la importación debes enviar la confirmación explícita desde el detalle de sesión.",
    };
  }

  const impactReviewed = formData.get("confirmImpactReviewed");
  const confirmationText = String(formData.get("confirmPublicationText") ?? "").trim();

  if (!impactReviewed || confirmationText !== "PUBLICAR") {
    return {
      ok: false,
      message:
        "Confirma que revisaste el impacto y escribe PUBLICAR antes de aplicar esta importación.",
    };
  }

  return { ok: true };
}

export function shouldRedirectAdminImportPublication(request: Request) {
  const accept = request.headers.get("accept")?.toLowerCase() ?? "";
  return accept.includes("text/html") && !accept.includes("application/json");
}

export function buildAdminImportSessionDetailUrl(
  request: Request,
  sessionId: string,
  options?: {
    publicationError?: string;
  },
) {
  const url = new URL(`/admin/importaciones/${encodeURIComponent(sessionId)}`, request.url);
  if (options?.publicationError) {
    url.searchParams.set("publicationError", options.publicationError);
  }
  return url;
}

export function redirectAdminImportPublicationIfNeeded(
  request: Request,
  sessionId: string,
  options?: {
    publicationError?: string;
  },
) {
  if (!shouldRedirectAdminImportPublication(request)) return null;
  return NextResponse.redirect(
    buildAdminImportSessionDetailUrl(request, sessionId, options),
    { status: 303 },
  );
}

export function getAdminImportApplyTarget(session: {
  id: string;
  module: AdminConfigModule;
  fileName?: string | null;
}) {
  if (session.module === AdminConfigModule.PRICES) {
    return `/api/admin/prices/import/${session.id}/apply`;
  }

  if (session.module === AdminConfigModule.BENEFITS) {
    if (session.fileName?.startsWith("base-scholarships:")) {
      return `/api/admin/benefits/base-scholarships/import/${session.id}/apply`;
    }
    return `/api/admin/benefits/import/${session.id}/apply`;
  }

  if (session.module === AdminConfigModule.OFFER) {
    return `/api/admin/import-academic-offer/${session.id}/apply`;
  }

  return null;
}

export function getAdminImportPublicationChecklist(module: AdminConfigModule) {
  const shared = [
    "El archivo fue validado y la sesión aparece como borrador.",
    "No hay errores bloqueantes en la sección de errores.",
    "Warnings revisados y aceptados por operación.",
    "Diff preview revisado antes de publicar.",
    "Existe snapshot anterior cuando el módulo soporta rollback.",
  ];

  if (module === AdminConfigModule.PRICES) {
    return [
      ...shared,
      "Verificar que los precios no incluyan símbolos de moneda ni separadores ambiguos.",
      "Confirmar que campus, programa, modalidad, plan y tier correspondan al alcance esperado.",
    ];
  }

  if (module === AdminConfigModule.BENEFITS) {
    return [
      ...shared,
      "Confirmar rangos de promedio y porcentajes de beneficio antes de publicar.",
      "Validar aliases de modalidad, línea de negocio y tipo de ingreso.",
    ];
  }

  if (module === AdminConfigModule.OFFER) {
    return [
      ...shared,
      "Confirmar ciclo activo y número de campus procesados.",
      "Revisar programas nuevos, actualizados o eliminados antes de publicar.",
    ];
  }

  return shared;
}

export const ADMIN_IMPORT_PUBLICATION_FLOW = [
  {
    title: "1. Crear borrador",
    description:
      "El importador valida el archivo, normaliza aliases, calcula warnings/errores y guarda una sesión preview sin cambiar datos productivos.",
  },
  {
    title: "2. Revisar impacto",
    description:
      "Operación revisa diff preview, payload, warnings, errores y snapshots desde el detalle de sesión.",
  },
  {
    title: "3. Publicar",
    description:
      "Al aplicar la sesión, el sistema ejecuta el importador, captura afterSnapshot, guarda resultado y marca la sesión como publicada.",
  },
  {
    title: "4. Revertir si aplica",
    description:
      "Si el módulo soporta rollback y existe snapshot anterior, se puede restaurar el estado previo manteniendo auditoría completa.",
  },
] as const;
