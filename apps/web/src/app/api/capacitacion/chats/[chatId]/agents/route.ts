import { AdminAuditAction, AdminConfigModule } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { writeAdminAuditLog } from "@/lib/admin-audit";
import { getSessionUser } from "@/lib/authz";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  addRoleplayAgentToChat,
  removeRoleplayAgentFromChat,
  type RoleplayAgentDifficulty,
  type RoleplayAgentMode,
} from "@/lib/training-roleplay-agents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ chatId: string }> };

function rateLimitResponse(retryAfterMs: number) {
  return NextResponse.json(
    { error: "rate_limited", retryAfterMs },
    { status: 429 },
  );
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await getSessionUser();
    if (session.status !== "ok" || !session.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limiter = await checkRateLimit(`roleplay-agent:add:${session.user.id}`, {
      limit: 20,
      windowMs: 60_000,
    });
    if (!limiter.ok) return rateLimitResponse(limiter.retryAfterMs);

    const { chatId } = await context.params;
    const body = (await request.json().catch(() => null)) as {
      mode?: RoleplayAgentMode;
      scenario?: string | null;
      difficulty?: RoleplayAgentDifficulty;
      extraInstructions?: string | null;
    } | null;

    if (!body?.mode) {
      return NextResponse.json({ error: "mode is required" }, { status: 400 });
    }

    const agent = await addRoleplayAgentToChat({
      actorUserId: session.user.id,
      chatId,
      mode: body.mode,
      scenario: body.scenario ?? null,
      difficulty: body.difficulty ?? "media",
      extraInstructions: body.extraInstructions ?? null,
    });

    await writeAdminAuditLog({
      module: AdminConfigModule.ACCESS,
      action: AdminAuditAction.CREATE,
      actor: { id: session.user.id, email: session.user.email },
      entityType: "TrainingRoleplayAgent",
      entityId: chatId,
      after: {
        chatId,
        mode: agent.mode,
        userId: agent.userId,
      },
      message: `Agente de roleplay agregado al chat ${chatId}.`,
    });

    return NextResponse.json({ success: true, agent }, { status: 201 });
  } catch (error) {
    console.error("Error adding roleplay agent:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to add roleplay agent",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const session = await getSessionUser();
    if (session.status !== "ok" || !session.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limiter = await checkRateLimit(`roleplay-agent:remove:${session.user.id}`, {
      limit: 20,
      windowMs: 60_000,
    });
    if (!limiter.ok) return rateLimitResponse(limiter.retryAfterMs);

    const { chatId } = await context.params;
    const result = await removeRoleplayAgentFromChat({
      actorUserId: session.user.id,
      chatId,
    });

    await writeAdminAuditLog({
      module: AdminConfigModule.ACCESS,
      action: AdminAuditAction.DELETE,
      actor: { id: session.user.id, email: session.user.email },
      entityType: "TrainingRoleplayAgent",
      entityId: chatId,
      before: {
        chatId,
        userId: result.userId,
      },
      message: `Agente de roleplay removido del chat ${chatId}.`,
    });

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error("Error removing roleplay agent:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to remove roleplay agent",
      },
      { status: 500 },
    );
  }
}
