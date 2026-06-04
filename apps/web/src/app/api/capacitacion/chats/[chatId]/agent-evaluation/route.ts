import { AdminAuditAction, AdminConfigModule } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { writeAdminAuditLog } from "@/lib/admin-audit";
import { getSessionUser } from "@/lib/authz";
import { checkRateLimit } from "@/lib/rate-limit";
import { evaluateRoleplayChat } from "@/lib/training-roleplay-agents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ chatId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await getSessionUser();
    if (session.status !== "ok" || !session.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limiter = await checkRateLimit(`roleplay-agent:evaluate:${session.user.id}`, {
      limit: 20,
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
      targetUserId?: string | null;
    } | null;

    const result = await evaluateRoleplayChat({
      actorUserId: session.user.id,
      chatId,
      targetUserId: body?.targetUserId ?? null,
    });

    await writeAdminAuditLog({
      module: AdminConfigModule.ACCESS,
      action: AdminAuditAction.CREATE,
      actor: { id: session.user.id, email: session.user.email },
      entityType: "TrainingRoleplayEvaluation",
      entityId: result.feedback.id,
      after: {
        chatId,
        rating: result.evaluation.rating,
      },
      message: `Evaluación de roleplay generada para chat ${chatId}.`,
    });

    return NextResponse.json({ success: true, ...result }, { status: 201 });
  } catch (error) {
    console.error("Error evaluating roleplay chat:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to evaluate roleplay chat",
      },
      { status: 500 },
    );
  }
}
