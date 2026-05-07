import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/authz";
import { getTrainingAccessContextForUser } from "@/lib/training-access";

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionUser();
    if (session.status !== "ok" || !session.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const orgId = request.nextUrl.searchParams.get("orgId");
    const access = await getTrainingAccessContextForUser(session.user.id, orgId);

    return NextResponse.json({
      success: true,
      viewer: access.viewer,
      selectedOrganizationId: access.selectedOrganizationId,
      organizations: access.organizations,
      permissions: access.permissions,
      canAccessCapacitacion: access.permissions.canAccessCapacitacion,
      canViewRolplay: access.permissions.canViewRolplay,
      canJoinRolplay: access.permissions.canJoinRolplay,
      canCreateRooms: access.permissions.canCreateRooms,
    });
  } catch (error) {
    console.error("Error checking permissions:", error);
    return NextResponse.json(
      { error: "Failed to check permissions" },
      { status: 500 }
    );
  }
}
