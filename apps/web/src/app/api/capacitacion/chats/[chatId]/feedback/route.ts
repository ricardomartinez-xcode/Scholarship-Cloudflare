import { NextRequest, NextResponse } from "next/server";

import { getSessionUser } from "@/lib/authz";
import {
  createTrainingFeedbackForUser,
  listTrainingFeedbackForUser,
} from "@/lib/training-rolplay";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ chatId: string }> },
) {
  try {
    const session = await getSessionUser();
    if (session.status !== "ok" || !session.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { chatId } = await context.params;
    const feedback = await listTrainingFeedbackForUser(session.user.id, chatId);
    if (!feedback) {
      return NextResponse.json(
        { error: "No tienes acceso a este chat." },
        { status: 403 },
      );
    }

    return NextResponse.json({
      success: true,
      feedback,
    });
  } catch (error) {
    console.error("Error fetching feedback:", error);
    return NextResponse.json(
      { error: "Failed to fetch feedback" },
      { status: 500 },
    );
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ chatId: string }> },
) {
  try {
    const session = await getSessionUser();
    if (session.status !== "ok" || !session.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { chatId } = await context.params;
    const body = (await request.json()) as {
      targetUserId?: string;
      rating?: number | null;
      summary?: string;
      strengths?: string | null;
      improvements?: string | null;
    };

    const targetUserId = String(body.targetUserId ?? "").trim();
    const summary = String(body.summary ?? "").trim();

    if (!targetUserId || !summary) {
      return NextResponse.json(
        { error: "targetUserId and summary are required" },
        { status: 400 },
      );
    }

    await createTrainingFeedbackForUser({
      actorUserId: session.user.id,
      chatId,
      targetUserId,
      rating: typeof body.rating === "number" ? body.rating : null,
      summary,
      strengths: body.strengths ?? null,
      improvements: body.improvements ?? null,
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error("Error creating feedback:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to save feedback",
      },
      { status: 500 },
    );
  }
}
