import { NextRequest, NextResponse } from "next/server";
import {
  TrainingAccessRole,
  TrainingRoomVisibility,
  type Prisma,
} from "@prisma/client";

import { getSessionUser } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import {
  getTrainingRoomAccessForUser,
  listTrainingRoomsForUser,
} from "@/lib/training-access";

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionUser();
    if (session.status !== "ok" || !session.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const orgId = request.nextUrl.searchParams.get("orgId");
    const { access, rooms } = await listTrainingRoomsForUser(session.user.id, orgId);

    return NextResponse.json({
      success: true,
      selectedOrganizationId: access.selectedOrganizationId,
      permissions: access.permissions,
      rooms,
    });
  } catch (error) {
    console.error("Error fetching rooms:", error);
    return NextResponse.json(
      { error: "Failed to fetch rooms" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionUser();
    if (session.status !== "ok" || !session.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as {
      orgId?: string;
      name?: string;
      description?: string;
      scenario?: string;
      visibility?: TrainingRoomVisibility;
    };

    const organizationId = String(body.orgId ?? "").trim();
    const name = String(body.name ?? "").trim();
    const description = String(body.description ?? "").trim() || null;
    const scenario = String(body.scenario ?? "").trim() || null;
    const visibility =
      body.visibility && Object.values(TrainingRoomVisibility).includes(body.visibility)
        ? body.visibility
        : TrainingRoomVisibility.org;

    if (!organizationId || !name) {
      return NextResponse.json(
        { error: "orgId and name are required" },
        { status: 400 },
      );
    }

    const access = await listTrainingRoomsForUser(session.user.id, organizationId);
    if (
      access.access.selectedOrganizationId !== organizationId ||
      !access.access.permissions.canCreateRooms
    ) {
      return NextResponse.json(
        { error: "No tienes permiso para crear salas en esta organización" },
        { status: 403 },
      );
    }

    const createdRoom = await prisma.trainingRoom.create({
      data: {
        organizationId,
        name,
        description,
        scenario,
        visibility,
        createdBy: session.user.id,
        members: {
          create: {
            userId: session.user.id,
            role: "trainer",
            accessRole: TrainingAccessRole.moderator,
            isAnonymous: false,
            anonymousAlias: null,
          },
        },
      },
      select: {
        id: true,
      },
    });

    const payload = await listTrainingRoomsForUser(session.user.id, organizationId);
    const room = payload.rooms.find((entry) => entry.id === createdRoom.id) ?? null;

    return NextResponse.json(
      {
        success: true,
        room,
      },
      { status: 201 },
    );
  } catch (error) {
    const details = error as Prisma.PrismaClientKnownRequestError | Error;
    console.error("Error creating room:", details);
    return NextResponse.json(
      { error: "Failed to create room" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getSessionUser();
    if (session.status !== "ok" || !session.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as {
      roomId?: string;
      name?: string;
      description?: string | null;
      scenario?: string | null;
      visibility?: TrainingRoomVisibility;
    };

    const roomId = String(body.roomId ?? "").trim();
    if (!roomId) {
      return NextResponse.json({ error: "roomId is required" }, { status: 400 });
    }

    const roomAccess = await getTrainingRoomAccessForUser(session.user.id, roomId);
    if (!roomAccess || !roomAccess.capabilities.canManageRoom) {
      return NextResponse.json(
        { error: "No tienes permiso para modificar esta sala." },
        { status: 403 },
      );
    }

    await prisma.trainingRoom.update({
      where: { id: roomId },
      data: {
        name: typeof body.name === "string" && body.name.trim() ? body.name.trim() : undefined,
        description:
          typeof body.description === "string"
            ? body.description.trim() || null
            : body.description === null
              ? null
              : undefined,
        scenario:
          typeof body.scenario === "string"
            ? body.scenario.trim() || null
            : body.scenario === null
              ? null
              : undefined,
        visibility:
          body.visibility && Object.values(TrainingRoomVisibility).includes(body.visibility)
            ? body.visibility
            : undefined,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating room:", error);
    return NextResponse.json(
      { error: "Failed to update room" },
      { status: 500 },
    );
  }
}
