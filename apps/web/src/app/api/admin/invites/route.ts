import { NextResponse } from "next/server";
import { AdminCapability, Role } from "@prisma/client";
 
import { requireAdminApiCapability } from "@/lib/api-auth";
import { cancelInvite, createInvite, deleteInvite, listInvites, resendInvite } from "@/lib/invites";
import { captureException, logStructured } from "@/lib/observability";
import { checkRateLimit } from "@/lib/rate-limit";
import { getSmtpStatus } from "@/lib/smtp";
import { SYSTEM_ROLES } from "@/lib/system-roles";
 
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DELIVERY_METHODS = ["email", "link"] as const;
type InviteDeliveryMethod = (typeof DELIVERY_METHODS)[number];
 
const getClientIp = (request: Request) =>
  (request.headers.get("x-forwarded-for") ?? "")
    .split(",")[0]
    ?.trim() || "unknown";
 
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
 
const buildRequestId = () =>
  `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
 
export async function GET() {
  const requestId = buildRequestId();
  let adminId = "unknown";
  try {
    const authResult = await requireAdminApiCapability(requestId, [
      AdminCapability.view_invites,
      AdminCapability.manage_invites,
    ]);
    if (!authResult.ok) return authResult.response;
    adminId = authResult.admin.id;
 
    const smtp = getSmtpStatus();
    const invites = (await listInvites(200)).map((invite) => ({
      id: invite.id,
      email: invite.email,
      role: invite.role,
      status: invite.status as "pending" | "used" | "expired" | "cancelled",
      createdAt: invite.createdAt.toISOString(),
      expiresAt: invite.expiresAt.toISOString(),
      usedAt: invite.usedAt ? invite.usedAt.toISOString() : null,
      cancelledAt: invite.cancelledAt ? invite.cancelledAt.toISOString() : null,
      createdByEmail: invite.createdBy?.email ?? "n/a",
      organizationId: invite.organization?.id ?? null,
      organizationName: invite.organization?.displayName ?? null,
    }));
 
    return NextResponse.json({
      ok: true,
      requestId,
      smtp: smtp.ok ? { ok: true } : { ok: false, missing: smtp.missing },
      invites,
    });
  } catch (error) {
    captureException(error, {
      module: "admin-invites",
      action: "list",
      result: "failure",
      requestId,
      actorUserId: adminId,
    }, "Failed to list invitations");
    return NextResponse.json(
      {
        ok: false,
        error: "No fue posible cargar invitaciones.",
        code: "GET_INVITES_FAILED",
        requestId,
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  const requestId = buildRequestId();
  let adminId = "unknown";
  try {
    const authResult = await requireAdminApiCapability(
      requestId,
      AdminCapability.manage_invites,
    );
    if (!authResult.ok) return authResult.response;
    adminId = authResult.admin.id;

    const body = (await request.json()) as {
      action?: "resend" | "cancel";
      id?: string;
      ids?: string[];
    };
    const action = String(body?.action ?? "").trim();
    const ids = Array.from(
      new Set(
        (Array.isArray(body?.ids) ? body.ids : [body?.id])
          .map((value) => String(value ?? "").trim())
          .filter(Boolean),
      ),
    );

    if (!ids.length) {
      return NextResponse.json(
        { ok: false, error: "Invitación inválida.", code: "INVALID_ID", requestId },
        { status: 400 }
      );
    }

    if (action === "resend") {
      if (ids.length > 1) {
        return NextResponse.json(
          {
            ok: false,
            error: "Reenviar en lote no está soportado.",
            code: "BULK_RESEND_NOT_SUPPORTED",
            requestId,
          },
          { status: 400 },
        );
      }
      const result = await resendInvite({ id: ids[0], createdById: adminId });
      return NextResponse.json({
        ok: true,
        requestId,
        mailSent: result.mailSent,
        warning: result.mailSent
          ? undefined
          : "No fue posible enviar el correo. Copia el enlace y envíalo manualmente.",
        acceptUrl: result.mailSent ? undefined : result.acceptUrl,
      });
    }

    if (action === "cancel") {
      for (const id of ids) {
        await cancelInvite({ id, cancelledById: adminId });
      }
      return NextResponse.json({ ok: true, requestId });
    }

    return NextResponse.json(
      { ok: false, error: "Acción inválida.", code: "INVALID_ACTION", requestId },
      { status: 400 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "No fue posible actualizar la invitación.";
    captureException(error, {
      module: "admin-invites",
      action: "patch",
      result: "failure",
      requestId,
      actorUserId: adminId,
      metadata: { message },
    }, "Failed to update invitation");
    return NextResponse.json(
      {
        ok: false,
        error: message,
        code: "INVITE_PATCH_FAILED",
        requestId,
      },
      { status: 400 }
    );
  }
}

export async function DELETE(request: Request) {
  const requestId = buildRequestId();
  try {
    const authResult = await requireAdminApiCapability(
      requestId,
      AdminCapability.manage_invites,
    );
    if (!authResult.ok) return authResult.response;

    const body = (await request.json()) as { id?: string; ids?: string[] };
    const ids = Array.from(
      new Set(
        (Array.isArray(body?.ids) ? body.ids : [body?.id])
          .map((value) => String(value ?? "").trim())
          .filter(Boolean),
      ),
    );
    if (!ids.length) {
      return NextResponse.json(
        { ok: false, error: "Invitación inválida.", code: "INVALID_ID", requestId },
        { status: 400 }
      );
    }

    for (const id of ids) {
      await deleteInvite({ id });
    }
    return NextResponse.json({ ok: true, requestId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No fue posible eliminar la invitación.";
    captureException(error, {
      module: "admin-invites",
      action: "delete",
      result: "failure",
      requestId,
      metadata: { message },
    }, "Failed to delete invitation");
    return NextResponse.json(
      {
        ok: false,
        error: message,
        code: "INVITE_DELETE_FAILED",
        requestId,
      },
      { status: 400 }
    );
  }
}
 
export async function POST(request: Request) {
  const requestId = buildRequestId();
  const ip = getClientIp(request);
  let adminId = "unknown";
  try {
    const authResult = await requireAdminApiCapability(
      requestId,
      AdminCapability.manage_invites,
    );
    if (!authResult.ok) return authResult.response;
    adminId = authResult.admin.id;
 
    const limiter = await checkRateLimit(`invite:create:${adminId}:${ip}`, {
      limit: 6,
      windowMs: 60_000,
    });
 
    if (!limiter.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: "Demasiadas solicitudes. Intenta de nuevo en un momento.",
          code: "RATE_LIMITED",
          requestId,
        },
        { status: 429 }
      );
    }
 
    const body = (await request.json()) as {
      email?: string;
      role?: string;
      organizationId?: string;
      deliveryMethod?: string;
    };
    const email = String(body?.email ?? "")
      .trim()
      .toLowerCase();
    const role = String(body?.role ?? Role.user).trim();
    const organizationId = body?.organizationId ? String(body.organizationId).trim() : undefined;
    const deliveryMethod = String(body?.deliveryMethod ?? "email")
      .trim()
      .toLowerCase() as InviteDeliveryMethod;

    if (!EMAIL_RE.test(email)) {
      return NextResponse.json(
        { ok: false, error: "Correo inválido.", code: "INVALID_EMAIL", requestId },
        { status: 400 }
      );
    }
 
    if (!SYSTEM_ROLES.includes(role as Role)) {
      return NextResponse.json(
        { ok: false, error: "Rol inválido.", code: "INVALID_ROLE", requestId },
        { status: 400 }
      );
    }

    if (!DELIVERY_METHODS.includes(deliveryMethod)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Método de entrega inválido.",
          code: "INVALID_DELIVERY_METHOD",
          requestId,
        },
        { status: 400 }
      );
    }
  
    if (deliveryMethod === "email") {
      const smtp = getSmtpStatus();
      if (!smtp.ok) {
        const error =
          smtp.reason === "invalid_port"
            ? "SMTP_PORT es inválido. Debe ser un puerto válido (1-65535)."
            : "Falta configurar SMTP para enviar invitaciones por correo. Completa las variables SMTP_* en Vercel.";
    
        return NextResponse.json(
          { ok: false, error, missing: smtp.missing, code: "SMTP_NOT_CONFIGURED", requestId },
          { status: 400 }
        );
      }
    }
  
    const result = await createInvite({
      email,
      role: role as Role,
      createdById: adminId,
      organizationId,
      deliveryMethod,
    });
 
    logStructured("info", "Invitation created", {
      module: "admin-invites",
      action: "create",
      result: "success",
      requestId,
      actorUserId: adminId,
      actorEmail: email,
      subjectType: "Invite",
      subjectId: result.invite.id,
      metadata: {
        organizationId: organizationId ?? null,
        deliveryMethod,
        mailSent: result.mailSent,
      },
    });
 
    const warning =
      deliveryMethod === "email" && !result.mailSent
        ? "No fue posible enviar el correo. Copia el enlace y envíalo manualmente."
        : undefined;
    return NextResponse.json({
      ok: true,
      mailSent: result.mailSent,
      warning,
      acceptUrl:
        deliveryMethod === "link" || !result.mailSent ? result.acceptUrl : undefined,
      deliveryMethod,
      requestId,
    });
  } catch (error) {
    captureException(error, {
      module: "admin-invites",
      action: "create",
      result: "failure",
      requestId,
      actorUserId: adminId,
      metadata: { ip },
    }, "Failed to create invitation");
 
    return NextResponse.json(
      {
        ok: false,
        error: "No fue posible crear la invitación.",
        code: "INVITE_CREATE_FAILED",
        requestId,
      },
      { status: 500 }
    );
  }
}
 
