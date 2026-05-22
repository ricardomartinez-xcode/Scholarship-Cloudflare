import { WhatsappTemplateKind } from "@prisma/client";
import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/authz";
import { captureException } from "@/lib/observability";
import {
  createPersonalWhatsappTemplate,
  deletePersonalWhatsappTemplate,
  duplicateOfficialWhatsappTemplate,
  listWhatsappTemplatesForUser,
  normalizeWhatsappTemplateBaseText,
  setActiveWhatsappTemplate,
  submitWhatsappTemplateForReview,
  updatePersonalWhatsappTemplate,
} from "@/lib/whatsapp-templates";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type TemplateAction =
  | "create_personal"
  | "update_personal"
  | "delete_personal"
  | "duplicate_official"
  | "set_active"
  | "submit_for_review";

const buildRequestId = () =>
  `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

function unauthorizedResponse(status: "unauthenticated" | "forbidden" | "inactive") {
  return NextResponse.json(
    {
      ok: false,
      error:
        status === "unauthenticated"
          ? "Sesión expirada."
          : "No tienes acceso a esta operación.",
      code: status.toUpperCase(),
    },
    { status: status === "unauthenticated" ? 401 : 403 },
  );
}

function parseKind(value: unknown) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === WhatsappTemplateKind.summary) return WhatsappTemplateKind.summary;
  if (normalized === WhatsappTemplateKind.detailed) return WhatsappTemplateKind.detailed;
  return null;
}

function parseTemplateName(value: unknown) {
  const normalized = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!normalized) return null;
  return normalized.slice(0, 80);
}

function parseBaseText(value: unknown) {
  const normalized = normalizeWhatsappTemplateBaseText(String(value ?? ""));
  if (!normalized) return null;
  return normalized.slice(0, 2000);
}

function parseTemplateId(value: unknown) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function toTemplateActionError(error: unknown) {
  if (!(error instanceof Error)) {
    return {
      status: 500,
      error: "No fue posible actualizar los templates.",
      code: "TEMPLATE_ACTION_FAILED",
    };
  }

  if (error.message.startsWith("invalid_template_tokens:")) {
    return {
      status: 400,
      error:
        "El texto base contiene variables no soportadas o posiciones fuera del catálogo disponible.",
      code: "INVALID_TEMPLATE_TOKENS",
    };
  }

  if (error.message === "invalid_template_name") {
    return {
      status: 400,
      error: "El nombre del template no es válido.",
      code: "INVALID_TEMPLATE_NAME",
    };
  }

  return {
    status: 500,
    error: "No fue posible actualizar los templates.",
    code: "TEMPLATE_ACTION_FAILED",
  };
}

export async function GET() {
  const auth = await getSessionUser();
  if (auth.status !== "ok") {
    return unauthorizedResponse(auth.status);
  }

  const collection = await listWhatsappTemplatesForUser(auth.user.id);
  return NextResponse.json({ ok: true, collection });
}

export async function POST(request: Request) {
  const requestId = buildRequestId();
  const auth = await getSessionUser();
  if (auth.status !== "ok") {
    return unauthorizedResponse(auth.status);
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Payload inválido.", code: "INVALID_JSON", requestId },
      { status: 400 },
    );
  }

  const action = String(body.action ?? "").trim() as TemplateAction;

  try {
    switch (action) {
      case "create_personal": {
        const kind = parseKind(body.kind);
        const name = parseTemplateName(body.name);
        if (!kind || !name) {
          return NextResponse.json(
            {
              ok: false,
              error: "Nombre o tipo inválido.",
              code: "INVALID_TEMPLATE_INPUT",
              requestId,
            },
            { status: 400 },
          );
        }

        await createPersonalWhatsappTemplate({
          userId: auth.user.id,
          name,
          kind,
          baseText: parseBaseText(body.baseText),
        });
        break;
      }
      case "update_personal": {
        const templateId = parseTemplateId(body.templateId);
        const kind = parseKind(body.kind);
        const name = parseTemplateName(body.name);
        if (!templateId || !kind || !name) {
          return NextResponse.json(
            {
              ok: false,
              error: "Template, nombre o tipo inválido.",
              code: "INVALID_TEMPLATE_INPUT",
              requestId,
            },
            { status: 400 },
          );
        }

        await updatePersonalWhatsappTemplate({
          userId: auth.user.id,
          templateId,
          name,
          kind,
          baseText: parseBaseText(body.baseText),
        });
        break;
      }
      case "delete_personal": {
        const templateId = parseTemplateId(body.templateId);
        if (!templateId) {
          return NextResponse.json(
            {
              ok: false,
              error: "Template inválido.",
              code: "INVALID_TEMPLATE_ID",
              requestId,
            },
            { status: 400 },
          );
        }

        await deletePersonalWhatsappTemplate({
          userId: auth.user.id,
          templateId,
        });
        break;
      }
      case "duplicate_official": {
        const sourceTemplateId = parseTemplateId(body.sourceTemplateId);
        if (!sourceTemplateId) {
          return NextResponse.json(
            {
              ok: false,
              error: "Template oficial inválido.",
              code: "INVALID_SOURCE_TEMPLATE",
              requestId,
            },
            { status: 400 },
          );
        }

        await duplicateOfficialWhatsappTemplate({
          userId: auth.user.id,
          sourceTemplateId,
        });
        break;
      }
      case "set_active": {
        const templateId = parseTemplateId(body.templateId);
        if (!templateId) {
          return NextResponse.json(
            {
              ok: false,
              error: "Template inválido.",
              code: "INVALID_TEMPLATE_ID",
              requestId,
            },
            { status: 400 },
          );
        }

        await setActiveWhatsappTemplate({
          userId: auth.user.id,
          templateId,
        });
        break;
      }
      case "submit_for_review": {
        const templateId = parseTemplateId(body.templateId);
        if (!templateId) {
          return NextResponse.json(
            {
              ok: false,
              error: "Template inválido.",
              code: "INVALID_TEMPLATE_ID",
              requestId,
            },
            { status: 400 },
          );
        }

        await submitWhatsappTemplateForReview({
          userId: auth.user.id,
          templateId,
        });
        break;
      }
      default:
        return NextResponse.json(
          { ok: false, error: "Acción inválida.", code: "INVALID_ACTION", requestId },
          { status: 400 },
        );
    }

    const collection = await listWhatsappTemplatesForUser(auth.user.id);
    return NextResponse.json({ ok: true, requestId, collection });
  } catch (error) {
    captureException(
      error,
      {
        module: "whatsapp-templates-api",
        action,
        result: "failure",
        requestId,
        actorUserId: auth.user.id,
        actorEmail: auth.user.email,
      },
      "Failed to execute WhatsApp template action",
    );

    const formatted = toTemplateActionError(error);
    return NextResponse.json(
      {
        ok: false,
        error: formatted.error,
        code: formatted.code,
        requestId,
      },
      { status: formatted.status },
    );
  }
}
