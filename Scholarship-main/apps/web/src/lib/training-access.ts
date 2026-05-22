import "server-only";

import {
  OrgRole,
  Role,
  TrainingAccessRole,
  TrainingRoomVisibility,
  type TrainingRoomMember,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type TrainingPermissionFlags = {
  canAccessCapacitacion: boolean;
  canViewRolplay: boolean;
  canJoinRolplay: boolean;
  canCreateRooms: boolean;
};

export type TrainingOrganizationAccess = {
  organizationId: string;
  organizationName: string;
  isMember: boolean;
  memberRole: OrgRole | null;
  permissions: TrainingPermissionFlags;
};

export type TrainingViewer = {
  userId: string;
  email: string;
  displayName: string;
  role: Role;
};

export type EffectiveTrainingRole = "user" | "moderator" | "admin" | "owner";

export type TrainingRoleCapabilities = {
  canManageRoom: boolean;
  canManageMembers: boolean;
  canManageChats: boolean;
  canLeaveFeedback: boolean;
  canEvaluate: boolean;
};

export type TrainingAccessContext = {
  viewer: TrainingViewer;
  selectedOrganizationId: string | null;
  organizations: TrainingOrganizationAccess[];
  permissions: TrainingPermissionFlags;
};

export const EMPTY_TRAINING_PERMISSIONS: TrainingPermissionFlags = {
  canAccessCapacitacion: false,
  canViewRolplay: false,
  canJoinRolplay: false,
  canCreateRooms: false,
};

export function buildDisplayName(email: string) {
  const localPart = email.split("@")[0] ?? email;
  return localPart
    .split(/[._-]+/)
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
}

function isSystemTrainingAdmin(role: Role) {
  return role === Role.owner || role === Role.admin_operativo;
}

function isOrganizationTrainingAdmin(role: OrgRole | null) {
  return role === OrgRole.owner || role === OrgRole.admin;
}

function normalizePermissions(
  input: Partial<TrainingPermissionFlags>,
  isMember: boolean,
): TrainingPermissionFlags {
  const permissions: TrainingPermissionFlags = {
    canAccessCapacitacion: input.canAccessCapacitacion ?? false,
    canViewRolplay: input.canViewRolplay ?? false,
    canJoinRolplay: input.canJoinRolplay ?? false,
    canCreateRooms: input.canCreateRooms ?? false,
  };

  if (permissions.canCreateRooms) {
    permissions.canJoinRolplay = true;
  }

  if (permissions.canJoinRolplay) {
    permissions.canViewRolplay = true;
  }

  permissions.canAccessCapacitacion =
    permissions.canAccessCapacitacion ||
    isMember ||
    permissions.canViewRolplay ||
    permissions.canJoinRolplay ||
    permissions.canCreateRooms;

  return permissions;
}

export function resolveTrainingEffectiveRole(input: {
  systemRole: Role;
  organizationRole: OrgRole | null;
  roomAccessRole: TrainingAccessRole | null | undefined;
  canCreateRooms: boolean;
}): EffectiveTrainingRole {
  if (input.systemRole === Role.owner || input.roomAccessRole === TrainingAccessRole.owner) {
    return "owner";
  }

  if (
    input.systemRole === Role.admin_operativo ||
    isOrganizationTrainingAdmin(input.organizationRole) ||
    input.roomAccessRole === TrainingAccessRole.admin
  ) {
    return "admin";
  }

  if (
    input.roomAccessRole === TrainingAccessRole.moderator ||
    input.canCreateRooms
  ) {
    return "moderator";
  }

  return "user";
}

export function resolveTrainingRoleCapabilities(
  role: EffectiveTrainingRole,
): TrainingRoleCapabilities {
  switch (role) {
    case "owner":
      return {
        canManageRoom: true,
        canManageMembers: true,
        canManageChats: true,
        canLeaveFeedback: true,
        canEvaluate: true,
      };
    case "admin":
      return {
        canManageRoom: true,
        canManageMembers: true,
        canManageChats: true,
        canLeaveFeedback: true,
        canEvaluate: false,
      };
    case "moderator":
      return {
        canManageRoom: true,
        canManageMembers: true,
        canManageChats: true,
        canLeaveFeedback: true,
        canEvaluate: true,
      };
    default:
      return {
        canManageRoom: false,
        canManageMembers: false,
        canManageChats: false,
        canLeaveFeedback: false,
        canEvaluate: false,
      };
  }
}

export async function getTrainingAccessContextForUser(
  userId: string,
  preferredOrgId?: string | null,
): Promise<TrainingAccessContext> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      role: true,
    },
  });

  const [memberships, explicitPermissions, adminOrganizations] = await Promise.all([
    prisma.organizationMember.findMany({
      where: { userId },
      select: {
        organizationId: true,
        role: true,
        organization: {
          select: {
            displayName: true,
          },
        },
      },
      orderBy: {
        organization: { displayName: "asc" },
      },
    }),
    prisma.trainingRoomPermission.findMany({
      where: { userId },
      select: {
        organizationId: true,
        canViewRolplay: true,
        canJoinRolplay: true,
        canCreateRoom: true,
        organization: {
          select: {
            displayName: true,
          },
        },
      },
      orderBy: {
        organization: { displayName: "asc" },
      },
    }),
    isSystemTrainingAdmin(user.role)
      ? prisma.organization.findMany({
          where: { isActive: true },
          select: {
            id: true,
            displayName: true,
          },
          orderBy: { displayName: "asc" },
        })
      : Promise.resolve([]),
  ]);

  const organizationMap = new Map<string, TrainingOrganizationAccess>();

  for (const organization of adminOrganizations) {
    organizationMap.set(organization.id, {
      organizationId: organization.id,
      organizationName: organization.displayName,
      isMember: false,
      memberRole: null,
      permissions: normalizePermissions(
        {
          canAccessCapacitacion: true,
          canViewRolplay: true,
          canJoinRolplay: true,
          canCreateRooms: true,
        },
        false,
      ),
    });
  }

  for (const membership of memberships) {
    const isOrgAdmin = isOrganizationTrainingAdmin(membership.role);
    const existing = organizationMap.get(membership.organizationId);
    organizationMap.set(membership.organizationId, {
      organizationId: membership.organizationId,
      organizationName: membership.organization.displayName,
      isMember: true,
      memberRole: membership.role,
      permissions: normalizePermissions(
        {
          canAccessCapacitacion: true,
          canViewRolplay:
            existing?.permissions.canViewRolplay ||
            isSystemTrainingAdmin(user.role) ||
            isOrgAdmin,
          canJoinRolplay:
            existing?.permissions.canJoinRolplay ||
            isSystemTrainingAdmin(user.role) ||
            isOrgAdmin,
          canCreateRooms:
            existing?.permissions.canCreateRooms ||
            isSystemTrainingAdmin(user.role) ||
            isOrgAdmin,
        },
        true,
      ),
    });
  }

  for (const permission of explicitPermissions) {
    const existing = organizationMap.get(permission.organizationId);
    organizationMap.set(permission.organizationId, {
      organizationId: permission.organizationId,
      organizationName:
        existing?.organizationName ?? permission.organization.displayName,
      isMember: existing?.isMember ?? false,
      memberRole: existing?.memberRole ?? null,
      permissions: normalizePermissions(
        {
          canAccessCapacitacion: true,
          canViewRolplay:
            (existing?.permissions.canViewRolplay ?? false) || permission.canViewRolplay,
          canJoinRolplay:
            (existing?.permissions.canJoinRolplay ?? false) || permission.canJoinRolplay,
          canCreateRooms:
            (existing?.permissions.canCreateRooms ?? false) || permission.canCreateRoom,
        },
        existing?.isMember ?? false,
      ),
    });
  }

  const organizations = Array.from(organizationMap.values()).sort((left, right) =>
    left.organizationName.localeCompare(right.organizationName),
  );

  const fallbackOrganization =
    organizations.find(
      (entry) =>
        entry.permissions.canViewRolplay ||
        entry.permissions.canJoinRolplay ||
        entry.permissions.canCreateRooms,
    ) ??
    organizations.find((entry) => entry.isMember) ??
    organizations[0] ??
    null;

  const selectedOrganizationId =
    preferredOrgId && organizationMap.has(preferredOrgId)
      ? preferredOrgId
      : fallbackOrganization?.organizationId ?? null;

  const selectedOrganization =
    organizations.find((entry) => entry.organizationId === selectedOrganizationId) ??
    null;

  return {
    viewer: {
      userId: user.id,
      email: user.email,
      displayName: buildDisplayName(user.email),
      role: user.role,
    },
    selectedOrganizationId,
    organizations,
    permissions: selectedOrganization?.permissions ?? EMPTY_TRAINING_PERMISSIONS,
  };
}

export async function getTrainingRoomAccessForUser(
  userId: string,
  roomId: string,
) {
  const room = await prisma.trainingRoom.findUnique({
    where: { id: roomId },
    select: {
      id: true,
      name: true,
      description: true,
      organizationId: true,
      visibility: true,
      createdBy: true,
      members: {
        where: { userId, leftAt: null },
        select: {
          id: true,
          role: true,
          accessRole: true,
          isAnonymous: true,
          anonymousAlias: true,
        },
        take: 1,
      },
      organization: {
        select: {
          displayName: true,
        },
      },
    },
  });

  if (!room) {
    return null;
  }

  const access = await getTrainingAccessContextForUser(userId, room.organizationId);
  const organizationAccess =
    access.organizations.find(
      (entry) => entry.organizationId === room.organizationId,
    ) ?? null;
  const membership = room.members[0] ?? null;
  const isCreator = room.createdBy === userId;
  const effectiveRole = resolveTrainingEffectiveRole({
    systemRole: access.viewer.role,
    organizationRole: organizationAccess?.memberRole ?? null,
    roomAccessRole: membership?.accessRole ?? null,
    canCreateRooms: access.permissions.canCreateRooms,
  });
  const capabilities = resolveTrainingRoleCapabilities(effectiveRole);
  const elevatedAccess = effectiveRole !== "user";

  const canSeeOrgRoom =
    room.visibility === TrainingRoomVisibility.org &&
    Boolean(organizationAccess?.isMember) &&
    access.permissions.canViewRolplay;
  const canSeePublicRoom =
    room.visibility === TrainingRoomVisibility.public &&
    access.permissions.canViewRolplay;
  const canJoinOrgRoom =
    room.visibility === TrainingRoomVisibility.org &&
    Boolean(organizationAccess?.isMember) &&
    access.permissions.canJoinRolplay;
  const canJoinPublicRoom =
    room.visibility === TrainingRoomVisibility.public &&
    access.permissions.canJoinRolplay;

  return {
    room: {
      id: room.id,
      name: room.name,
      description: room.description,
      organizationId: room.organizationId,
      organizationName: room.organization.displayName,
      visibility: room.visibility,
      createdBy: room.createdBy,
    },
    access,
    organizationAccess,
    membership,
    effectiveRole,
    capabilities,
    canView: Boolean(
      elevatedAccess ||
        membership ||
        isCreator ||
        canSeeOrgRoom ||
        canSeePublicRoom,
    ),
    canJoin: Boolean(
      elevatedAccess ||
        membership ||
        isCreator ||
        canJoinOrgRoom ||
        canJoinPublicRoom,
    ),
    canManage: Boolean(elevatedAccess || isCreator || capabilities.canManageRoom),
  };
}

export async function listTrainingRoomsForUser(
  userId: string,
  preferredOrgId?: string | null,
) {
  const access = await getTrainingAccessContextForUser(userId, preferredOrgId);
  const organizationId = access.selectedOrganizationId;

  if (!organizationId) {
    return { access, rooms: [] };
  }

  const organizationAccess =
    access.organizations.find((entry) => entry.organizationId === organizationId) ??
    null;
  const elevatedOrgAccess =
    isSystemTrainingAdmin(access.viewer.role) ||
    isOrganizationTrainingAdmin(organizationAccess?.memberRole ?? null) ||
    access.permissions.canCreateRooms;

  const visibilityFilters =
    access.permissions.canViewRolplay
      ? [
          { visibility: TrainingRoomVisibility.public },
          ...(organizationAccess?.isMember
            ? [{ visibility: TrainingRoomVisibility.org }]
            : []),
        ]
      : [];

  const rooms = await prisma.trainingRoom.findMany({
    where: elevatedOrgAccess
      ? { organizationId }
      : {
          organizationId,
          OR: [{ members: { some: { userId, leftAt: null } } }, ...visibilityFilters],
        },
    select: {
      id: true,
      name: true,
      description: true,
      scenario: true,
      visibility: true,
      createdAt: true,
      updatedAt: true,
      createdBy: true,
      _count: {
        select: {
          members: true,
          messages: true,
          chats: true,
        },
      },
      members: {
        where: { userId, leftAt: null },
        select: {
          role: true,
          accessRole: true,
          isAnonymous: true,
          anonymousAlias: true,
        },
        take: 1,
      },
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
  });

  return {
    access,
    rooms: rooms.map((room) => {
      const effectiveRole = resolveTrainingEffectiveRole({
        systemRole: access.viewer.role,
        organizationRole: organizationAccess?.memberRole ?? null,
        roomAccessRole: room.members[0]?.accessRole ?? null,
        canCreateRooms: access.permissions.canCreateRooms,
      });

      return {
        id: room.id,
        name: room.name,
        description: room.description,
        scenario: room.scenario,
        visibility: room.visibility,
        createdAt: room.createdAt.toISOString(),
        updatedAt: room.updatedAt.toISOString(),
        memberCount: room._count.members,
        messageCount: room._count.messages,
        chatCount: room._count.chats,
        userRole: effectiveRole,
        isAnonymous: room.members[0]?.isAnonymous ?? true,
        anonymousAlias: room.members[0]?.anonymousAlias ?? null,
        accessRole: room.members[0]?.accessRole ?? null,
        createdBy: room.createdBy,
      };
    }),
  };
}

export async function ensureTrainingMembership(
  roomId: string,
  userId: string,
): Promise<TrainingRoomMember> {
  const existingMembership = await prisma.trainingRoomMember.findUnique({
    where: {
      roomId_userId: {
        roomId,
        userId,
      },
    },
  });

  if (existingMembership) {
    if (existingMembership.leftAt) {
      return prisma.trainingRoomMember.update({
        where: { id: existingMembership.id },
        data: { leftAt: null },
      });
    }
    return existingMembership;
  }

  const currentMemberCount = await prisma.trainingRoomMember.count({
    where: { roomId },
  });

  return prisma.trainingRoomMember.create({
    data: {
      roomId,
      userId,
      accessRole: TrainingAccessRole.user,
      anonymousAlias: `Participante ${String(currentMemberCount + 1).padStart(2, "0")}`,
      isAnonymous: true,
    },
  });
}
