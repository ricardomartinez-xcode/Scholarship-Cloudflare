import { NextRequest, NextResponse } from "next/server";
import { TrainingAccessRole } from "@prisma/client";

import { getSessionUser } from "@/lib/authz";
import {
  listTrainingRoomMembersForUser,
  upsertTrainingRoomMemberForUser,
} from "@/lib/training-rolplay";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ roomId: string }> },
) {
  try {
    const session = await getSessionUser();
    if (session.status !== "ok" || !session.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { roomId } = await context.params;
    const payload = await listTrainingRoomMembersForUser(session.user.id, roomId);
    if (!payload) {
      return NextResponse.json(
        { error: "No tienes acceso a esta sala." },
        { status: 403 },
      );
    }

    return NextResponse.json({
      success: true,
      roomAccess: {
        effectiveRole: payload.roomAccess.effectiveRole,
        capabilities: payload.roomAccess.capabilities,
      },
      members: payload.members,
      eligibleUsers: payload.eligibleUsers,
    });
  } catch (error) {
    console.error("Error fetching room members:", error);
    return NextResponse.json(
      { error: "Failed to fetch room members" },
      { status: 500 },
    );
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ roomId: string }> },
) {
  try {
    const session = await getSessionUser();
    if (session.status !== "ok" || !session.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { roomId } = await context.params;
    const body = (await request.json()) as {
      targetUserId?: string;
      accessRole?: TrainingAccessRole;
      isAnonymous?: boolean;
      anonymousAlias?: string | null;
      active?: boolean;
    };

    const targetUserId = String(body.targetUserId ?? "").trim();
    if (!targetUserId) {
      return NextResponse.json(
        { error: "targetUserId is required" },
        { status: 400 },
      );
    }

    await upsertTrainingRoomMemberForUser({
      actorUserId: session.user.id,
      roomId,
      targetUserId,
      accessRole:
        body.accessRole && Object.values(TrainingAccessRole).includes(body.accessRole)
          ? body.accessRole
          : TrainingAccessRole.user,
      isAnonymous: typeof body.isAnonymous === "boolean" ? body.isAnonymous : true,
      anonymousAlias: body.anonymousAlias ?? null,
      active: body.active,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating room member:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to update member",
      },
      { status: 500 },
    );
  }
}
