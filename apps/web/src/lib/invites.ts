import crypto from "crypto";

import { BusinessEventType, Role } from "@prisma/client";

import { writeBusinessEventSafe } from "@/lib/business-events";
import { sendMail } from "@/lib/mailer";
import { normalizeEmail } from "@/lib/normalize";
import { captureException } from "@/lib/observability";
import { prisma } from "@/lib/prisma";
import { getSystemRoleMeta, maxSystemRole } from "@/lib/system-roles";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type InviteLifecycleStatus =
  | "pending"
  | "used"
  | "expired"
  | "cancelled";

export type InviteStatus = InviteLifecycleStatus;

export type ConsumeInviteTokenResult = {
  invite: {
    id: string;
    organizationId: string | null;
    usedAt: Date | null;
  };
  user: {
    id: string;
    email: string;
    role: Role;
  };
  organizationId: string | null;
  alreadyUsed: boolean;
};

export function computeInviteStatus(
  invite: {
    usedAt: Date | null;
    expiresAt: Date;
    createdAt: Date;
    cancelledAt?: Date | null;
  },
  now: Date = new Date(),
): InviteLifecycleStatus {
  if (invite.usedAt) return "used";
  if (invite.cancelledAt) return "cancelled";
  if (invite.expiresAt.getTime() <= invite.createdAt.getTime()) return "cancelled";
  if (invite.expiresAt.getTime() <= now.getTime()) return "expired";
  return "pending";
}

export class InviteLifecycleError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "INVITE_NOT_FOUND"
      | "INVITE_ALREADY_USED"
      | "INVITE_EXPIRED"
      | "INVITE_CANCELLED"
      | "WRONG_EMAIL"
      | "INVALID_TRANSITION",
  ) {
    super(message);
    this.name = "InviteLifecycleError";
  }
}

export function evaluateInviteAcceptanceState(
  invite: {
    email: string;
    usedAt: Date | null;
    expiresAt: Date;
    createdAt: Date;
    cancelledAt?: Date | null;
  },
  sessionEmail: string,
  now: Date = new Date(),
) {
  if (normalizeEmail(invite.email) !== normalizeEmail(sessionEmail)) {
    throw new InviteLifecycleError(
      "La invitación no corresponde a este correo.",
      "WRONG_EMAIL",
    );
  }

  const inviteStatus = computeInviteStatus(invite, now);
  if (inviteStatus === "cancelled") {
    throw new InviteLifecycleError("Invitación cancelada.", "INVITE_CANCELLED");
  }
  if (inviteStatus === "expired") {
    throw new InviteLifecycleError("Invitación expirada.", "INVITE_EXPIRED");
  }
  if (inviteStatus === "used") {
    return "already_used" as const;
  }

  return "accept" as const;
}

const getBaseUrl = () =>
  (process.env.INVITE_BASE_URL ??
    process.env.NEXT_PUBLIC_BASE_URL ??
    "https://recalc.relead.com.mx").replace(/\/+$/, "");

export const hashInviteToken = (token: string) =>
  crypto.createHash("sha256").update(token).digest("hex");

function buildInviteEmailContext(input: {
  acceptUrl: string;
  expiresAt: Date;
  inviterEmail: string;
  organizationName: string | null;
  role: Role;
}) {
  const expiresLabel = input.expiresAt.toLocaleDateString("es-MX", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const roleLabel = getSystemRoleMeta(input.role).label;
  const organizationLine = input.organizationName
    ? `Ingresarás a la organización <strong>${input.organizationName}</strong>.`
    : "El acceso no está ligado a una organización específica.";
  const year = input.expiresAt.getFullYear();

  return {
    html: `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html lang="es" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Tu invitación a ReCalc</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f1f5f9;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:580px;background-color:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="background-color:#0f172a;padding:20px 28px;">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td>
                    <img src="${getBaseUrl()}/branding/logo-recalc.png" alt="ReCalc" height="36" style="display:block;height:36px;width:auto;" />
                  </td>
                  <td align="right" style="color:#94a3b8;font-size:11px;letter-spacing:.18em;text-transform:uppercase;">
                    Invitación
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 28px 20px 28px;">
              <h1 style="margin:0 0 10px 0;color:#0f172a;font-size:20px;font-weight:700;line-height:1.3;">
                Tienes una invitación pendiente en <span style="color:#059669;">ReCalc</span>
              </h1>
              <p style="margin:0 0 16px 0;color:#475569;font-size:14px;line-height:1.65;">
                ${input.inviterEmail} te invitó a entrar con acceso <strong>${roleLabel}</strong>.
              </p>
              <div style="background-color:#f8fafc;border:1px solid #cbd5e1;border-radius:10px;padding:14px 18px;margin:14px 0;color:#334155;font-size:13px;line-height:1.7;">
                <div><strong>Quién invita:</strong> ${input.inviterEmail}</div>
                <div><strong>Acceso:</strong> ${roleLabel}</div>
                <div><strong>Organización:</strong> ${input.organizationName ?? "Sin organización"}</div>
                <div><strong>Siguiente paso:</strong> inicia sesión o regístrate con este mismo correo y luego confirma la aceptación.</div>
              </div>
              <p style="margin:0 0 14px 0;color:#475569;font-size:14px;line-height:1.65;">
                ${organizationLine}
              </p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 10px 0;">
                <tr>
                  <td style="border-radius:10px;background-color:#059669;">
                    <a href="${input.acceptUrl}" style="display:inline-block;background-color:#059669;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 28px;border-radius:10px;letter-spacing:.01em;">
                      Revisar invitación
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:14px 0 0 0;color:#64748b;font-size:12px;line-height:1.6;">
                Este enlace vence el <strong style="color:#334155;">${expiresLabel}</strong>.<br />
                Si el botón no funciona, copia y pega este enlace en tu navegador:<br />
                <a href="${input.acceptUrl}" style="color:#2563eb;text-decoration:underline;word-break:break-all;">${input.acceptUrl}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 28px;">
              <div style="height:1px;background-color:#e2e8f0;"></div>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 28px;background-color:#f8fafc;">
              <p style="margin:0 0 6px 0;color:#64748b;font-size:12px;line-height:1.6;">
                Recibiste este correo porque una persona administradora de ReCalc te invitó a la plataforma. Nadie obtendrá acceso sin tu confirmación explícita.
              </p>
              <p style="margin:0;color:#94a3b8;font-size:11px;">
                © ${year} ReCalc · ReLead · <a href="${getBaseUrl()}" style="color:#94a3b8;text-decoration:underline;">${getBaseUrl().replace(/^https?:\/\//, "")}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    text: `Hola,

${input.inviterEmail} te invitó a ReCalc con acceso ${roleLabel}.
Organización: ${input.organizationName ?? "Sin organización"}.
Siguiente paso: inicia sesión o regístrate con este mismo correo y luego confirma la aceptación.

Enlace de revisión (vence el ${expiresLabel}):
${input.acceptUrl}

Si no esperabas esta invitación, puedes ignorarla.
`,
  };
}

export async function getInviteByToken(token: string) {
  if (!token) return null;
  const tokenHash = hashInviteToken(token);
  const invite = await prisma.invite.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      email: true,
      role: true,
      expiresAt: true,
      usedAt: true,
      cancelledAt: true,
      createdAt: true,
      createdBy: {
        select: { email: true },
      },
      organization: {
        select: { id: true, displayName: true },
      },
    },
  });

  if (!invite) return null;
  return {
    ...invite,
    inviterEmail: invite.createdBy.email,
    organizationName: invite.organization?.displayName ?? null,
    status: computeInviteStatus(invite),
  };
}

export async function createInvite(params: {
  email: string;
  role: Role;
  createdById: string;
  organizationId?: string | null;
  deliveryMethod?: "email" | "link";
}) {
  const email = normalizeEmail(params.email);
  if (!email) {
    throw new Error("Correo inválido.");
  }

  const organizationId = params.organizationId || null;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + INVITE_TTL_MS);
  const deliveryMethod = params.deliveryMethod ?? "email";
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashInviteToken(token);

  const [creator, organization] = await Promise.all([
    prisma.user.findUnique({
      where: { id: params.createdById },
      select: { email: true },
    }),
    organizationId
      ? prisma.organization.findFirst({
          where: { id: organizationId, isActive: true },
          select: { id: true, displayName: true },
        })
      : Promise.resolve(null),
  ]);

  if (!creator) {
    throw new Error("No se encontró el usuario que crea la invitación.");
  }
  if (organizationId && !organization) {
    throw new Error("La organización seleccionada no existe o está inactiva.");
  }

  const invite = await prisma.$transaction(async (tx) => {
    await tx.invite.updateMany({
      where: {
        email: { equals: email, mode: "insensitive" },
        usedAt: null,
        cancelledAt: null,
        expiresAt: { gt: now },
        organizationId,
      },
      data: {
        cancelledAt: now,
        cancelledById: params.createdById,
      },
    });

    return tx.invite.create({
      data: {
        email,
        role: params.role,
        tokenHash,
        expiresAt,
        lastSentAt: now,
        createdById: params.createdById,
        organizationId,
      },
    });
  });

  const acceptUrl = `${getBaseUrl()}/invite/accept?token=${token}`;
  const emailPayload = buildInviteEmailContext({
    acceptUrl,
    expiresAt,
    inviterEmail: creator.email,
    organizationName: organization?.displayName ?? null,
    role: params.role,
  });

  let mailSent = false;
  let mailError: string | null = null;

  if (deliveryMethod === "email") {
    try {
      await sendMail({
        to: email,
        subject: "Tu invitación a ReCalc",
        text: emailPayload.text,
        html: emailPayload.html,
      });
      mailSent = true;
    } catch (err) {
      mailError = err instanceof Error ? err.message : "mail_send_failed";
      captureException(
        err,
        {
          module: "invites",
          action: "sendInviteEmail",
          result: "failure",
          actorUserId: params.createdById,
          actorEmail: email,
          subjectType: "Invite",
          subjectId: invite.id,
          metadata: {
            organizationId,
            deliveryMethod,
          },
        },
        "Failed to send invite email",
      );
    }
  }

  await writeBusinessEventSafe({
    type: BusinessEventType.INVITE_CREATED,
    userId: params.createdById,
    subjectType: "Invite",
    subjectId: invite.id,
    metadata: {
      role: params.role,
      organizationId,
      deliveryMethod,
      mailSent,
      mailError,
    },
  });

  return {
    invite,
    acceptUrl,
    mailSent,
    mailError,
    deliveryMethod,
    inviterEmail: creator.email,
    organizationName: organization?.displayName ?? null,
  };
}

export async function consumeInviteToken(params: {
  token: string;
  authUserId: string;
  email: string;
}): Promise<ConsumeInviteTokenResult> {
  const normalizedEmail = normalizeEmail(params.email);
  const tokenHash = hashInviteToken(params.token);
  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
    const invite = await tx.invite.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        email: true,
        role: true,
        expiresAt: true,
        createdAt: true,
        usedAt: true,
        cancelledAt: true,
        organizationId: true,
      },
    });

    if (!invite) {
      throw new InviteLifecycleError("Invitación inválida.", "INVITE_NOT_FOUND");
    }
    const acceptanceState = evaluateInviteAcceptanceState(invite, normalizedEmail, now);

    const existingUser = await tx.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, role: true },
    });

    const user = await tx.user.upsert({
      where: { email: normalizedEmail },
      update: {
        authUserId: params.authUserId,
        role: existingUser ? maxSystemRole(existingUser.role, invite.role) : invite.role,
        isActive: true,
        lastLoginAt: now,
      },
      create: {
        authUserId: params.authUserId,
        email: normalizedEmail,
        role: invite.role,
        isActive: true,
        lastLoginAt: now,
      },
    });

    let alreadyUsed = acceptanceState === "already_used";
    let usedAt = invite.usedAt;

    if (!invite.usedAt) {
      const markedAsUsed = await tx.invite.updateMany({
        where: {
          id: invite.id,
          usedAt: null,
          cancelledAt: null,
          expiresAt: { gt: now },
        },
        data: { usedAt: now },
      });

      if (markedAsUsed.count > 0) {
        usedAt = now;
      } else {
        const currentInvite = await tx.invite.findUnique({
          where: { id: invite.id },
          select: {
            id: true,
            email: true,
            role: true,
            expiresAt: true,
            createdAt: true,
            usedAt: true,
            cancelledAt: true,
            organizationId: true,
          },
        });

        if (!currentInvite) {
          throw new InviteLifecycleError("Invitación inválida.", "INVITE_NOT_FOUND");
        }
        const currentState = evaluateInviteAcceptanceState(
          currentInvite,
          normalizedEmail,
          now,
        );
        if (currentState !== "already_used" || !currentInvite.usedAt) {
          throw new InviteLifecycleError(
            "No fue posible confirmar la aceptación de la invitación.",
            "INVALID_TRANSITION",
          );
        }

        alreadyUsed = true;
        usedAt = currentInvite.usedAt;
      }
    }

    if (invite.organizationId) {
      await tx.organizationMember.upsert({
        where: {
          organizationId_userId: {
            organizationId: invite.organizationId,
            userId: user.id,
          },
        },
        update: {},
        create: {
          organizationId: invite.organizationId,
          userId: user.id,
          role: "member",
        },
      });
    }

    return {
      invite: {
        id: invite.id,
        organizationId: invite.organizationId,
        usedAt,
      },
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      organizationId: invite.organizationId,
      alreadyUsed,
    } satisfies ConsumeInviteTokenResult;
  });

  return result;
}

export async function listInvites(limit = 100) {
  const rows = await prisma.invite.findMany({
    orderBy: [{ createdAt: "desc" }],
    take: limit,
    include: {
      createdBy: {
        select: { id: true, email: true },
      },
      organization: {
        select: { id: true, displayName: true },
      },
    },
  });

  const now = new Date();
  return rows.map((row) => ({
    ...row,
    status: computeInviteStatus(row, now),
  }));
}

export async function resendInvite(params: { id: string; createdById: string }) {
  const invite = await prisma.invite.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      createdAt: true,
      email: true,
      expiresAt: true,
      role: true,
      usedAt: true,
      cancelledAt: true,
      organizationId: true,
      resentCount: true,
    },
  });

  if (!invite) {
    throw new InviteLifecycleError("Invitación no encontrada.", "INVITE_NOT_FOUND");
  }
  if (invite.usedAt) {
    throw new InviteLifecycleError(
      "No se puede reenviar una invitación ya utilizada.",
      "INVALID_TRANSITION",
    );
  }
  if (computeInviteStatus(invite, new Date()) === "cancelled") {
    throw new InviteLifecycleError(
      "No se puede reenviar una invitación cancelada.",
      "INVALID_TRANSITION",
    );
  }

  await prisma.invite.update({
    where: { id: invite.id },
    data: {
      resentCount: invite.resentCount + 1,
      lastSentAt: new Date(),
    },
  });

  const resent = await createInvite({
    email: invite.email,
    role: invite.role,
    createdById: params.createdById,
    organizationId: invite.organizationId,
  });

  await writeBusinessEventSafe({
    type: BusinessEventType.INVITE_RESENT,
    userId: params.createdById,
    subjectType: "Invite",
    subjectId: resent.invite.id,
    metadata: {
      previousInviteId: invite.id,
      organizationId: invite.organizationId ?? null,
      mailSent: resent.mailSent,
      mailError: resent.mailError,
    },
  });

  return resent;
}

export async function cancelInvite(params: { id: string; cancelledById?: string | null }) {
  const invite = await prisma.invite.findUnique({
    where: { id: params.id },
    select: { id: true, createdAt: true, usedAt: true, cancelledAt: true },
  });

  if (!invite) {
    throw new InviteLifecycleError("Invitación no encontrada.", "INVITE_NOT_FOUND");
  }
  if (invite.usedAt) {
    throw new InviteLifecycleError(
      "No se puede cancelar una invitación ya utilizada.",
      "INVALID_TRANSITION",
    );
  }
  if (invite.cancelledAt) return;

  const now = new Date();
  await prisma.invite.update({
    where: { id: invite.id },
    data: {
      cancelledAt: now,
      cancelledById: params.cancelledById ?? null,
      expiresAt: invite.createdAt,
    },
  });
}

export async function deleteInvite(params: { id: string }) {
  const invite = await prisma.invite.findUnique({
    where: { id: params.id },
    select: { id: true, usedAt: true },
  });

  if (!invite) {
    throw new InviteLifecycleError("Invitación no encontrada.", "INVITE_NOT_FOUND");
  }
  if (invite.usedAt) {
    throw new InviteLifecycleError(
      "No se puede eliminar una invitación ya utilizada.",
      "INVALID_TRANSITION",
    );
  }

  await prisma.invite.delete({ where: { id: invite.id } });
}
