import { AdminAuditAction, AdminConfigModule } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { writeAdminAuditLog } from "@/lib/admin-audit";
import { getSessionUser } from "@/lib/authz";
import { checkRateLimit } from "@/lib/rate-limit";
import { broadcastTrainingMessage } from "@/lib/supabase/server-realtime";
import {
  generateRoleplayAgentReply,
  type RoleplayAgentDifficulty,
  type RoleplayAgentMode,
} from "@/lib/training-roleplay-agents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ chatId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await getSessionUser();
    if (session.status !== "ok" || !session.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limiter = await checkRateLimit(`roleplay-agent:reply:${session.user.id}`, {
      limit: 30,
      windowMs: 60_000,
    });
    if (!limiter.ok) {
      return NextResponse.json(
        { error: "rate_limited", retryAfterMs: limiter.retryAfterMs },
        { status: 429 },
      );
    }

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

    const result = await generateRoleplayAgentReply({
      actorUserId: session.user.id,
      chatId,
      mode: body.mode,
      scenario: body.scenario ?? null,
      difficulty: body.difficulty ?? "media",
      extraInstructions: body.extraInstructions ?? null,
    });

    await broadcastTrainingMessage(
      chatId,
      result.message as unknown as Record<string, unknown>,
    );

    await writeAdminAuditLog({
      module: AdminConfigModule.ACCESS,
      action: AdminAuditAction.CREATE,
      actor: { id: session.user.id, email: session.user.email },
      entityType: "TrainingRoleplayAgentReply",
      entityId: result.message.id,
      after: {
        chatId,
        mode: result.agent.mode,
        ai: result.ai,
      },
      message: `Respuesta de agente generada para chat ${chatId}.`,
    });

    return NextResponse.json({ success: true, ...result }, { status: 201 });
  } catch (error) {
    console.error("Error generating roleplay agent reply:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate roleplay agent reply",
      },
      { status: 500 },
    );
  }
}
