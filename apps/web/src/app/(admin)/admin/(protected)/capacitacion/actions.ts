"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  AdminAuditAction,
  AdminCapability,
  AdminConfigModule,
  TrainingRoomVisibility,
} from "@prisma/client";

import {
  requireAdminAccessUser,
} from "@/lib/admin-session";
import { writeAdminAuditLog } from "@/lib/admin-audit";
import { prisma } from "@/lib/prisma";

function canViewTrainingAdmin(
  capabilities: string[],
) {
  return [
    AdminCapability.view_users,
    AdminCapability.manage_users,
    AdminCapability.view_org_members,
    AdminCapability.manage_org_members,
  ].some((capability) => capabilities.includes(capability));
}

function canManageTrainingAdmin(
  capabilities: string[],
) {
  return [
    AdminCapability.manage_users,
    AdminCapability.manage_org_members,
  ].some((capability) => capabilities.includes(capability));
}

function readCheckbox(formData: FormData, key: string) {
  return formData.get(key) === "true";
}

function fail(message: string): never {
  redirect(`/admin/capacitacion?error=${encodeURIComponent(message)}`);
}

function success(message: string): never {
  redirect(`/admin/capacitacion?status=${encodeURIComponent(message)}`);
}

export async function upsertTrainingPermissionAction(formData: FormData) {
  const admin = await requireAdminAccessUser();
  if (!canManageTrainingAdmin(admin.capabilities)) {
    fail("No tienes permisos para administrar capacitación.");
  }

  const userId = String(formData.get("userId") ?? "").trim();
  const organizationId = String(formData.get("organizationId") ?? "").trim();
  const canViewRolplay = readCheckbox(formData, "canViewRolplay");
  const canJoinRolplay = readCheckbox(formData, "canJoinRolplay");
  const canCreateRoom = readCheckbox(formData, "canCreateRoom");

  if (!userId || !organizationId) {
    fail("Selecciona usuario y organización.");
  }

  const [user, organization, existing] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    }),
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, displayName: true },
    }),
    prisma.trainingRoomPermission.findUnique({
      where: {
        userId_organizationId: {
          userId,
          organizationId,
        },
      },
      select: {
        id: true,
        canViewRolplay: true,
        canJoinRolplay: true,
        canCreateRoom: true,
      },
    }),
  ]);

  if (!user || !organization) {
    fail("No se encontró el usuario o la organización seleccionada.");
  }

  const targetUser = user;
  const targetOrganization = organization;

  if (!canViewRolplay && !canJoinRolplay && !canCreateRoom) {
    if (existing) {
      await prisma.trainingRoomPermission.delete({
        where: {
          userId_organizationId: {
            userId,
            organizationId,
          },
        },
      });
    }

    await writeAdminAuditLog({
      module: AdminConfigModule.ACCESS,
      action: AdminAuditAction.UPDATE,
      actor: admin,
      entityType: "training.permission",
      entityId: existing?.id ?? `${userId}:${organizationId}`,
      before: existing ?? null,
      after: null,
      diffSummary: {
        userId,
        organizationId,
      },
      message: `Se retiraron permisos de capacitación para ${targetUser.email} en ${targetOrganization.displayName}.`,
    });

    revalidatePath("/admin/capacitacion");
    revalidatePath("/unidep/capacitacion");
    revalidatePath("/unidep/capacitacion/rolplay");
    success("Permisos retirados correctamente.");
  }

  const nextData = {
    canViewRolplay,
    canJoinRolplay,
    canCreateRoom,
  };

  const saved = await prisma.trainingRoomPermission.upsert({
    where: {
      userId_organizationId: {
        userId,
        organizationId,
      },
    },
    create: {
      userId,
      organizationId,
      ...nextData,
    },
    update: nextData,
  });

  await writeAdminAuditLog({
    module: AdminConfigModule.ACCESS,
    action: existing ? AdminAuditAction.UPDATE : AdminAuditAction.CREATE,
    actor: admin,
    entityType: "training.permission",
    entityId: saved.id,
    before: existing ?? null,
    after: nextData,
    diffSummary: {
      userId,
      organizationId,
      canViewRolplay,
      canJoinRolplay,
      canCreateRoom,
    },
    message: `Se actualizaron permisos de capacitación para ${targetUser.email} en ${targetOrganization.displayName}.`,
  });

  revalidatePath("/admin/capacitacion");
  revalidatePath("/unidep/capacitacion");
  revalidatePath("/unidep/capacitacion/rolplay");
  success("Permisos guardados correctamente.");
}

export async function createTrainingRoomAction(formData: FormData) {
  const admin = await requireAdminAccessUser();
  if (!canManageTrainingAdmin(admin.capabilities)) {
    fail("No tienes permisos para crear salas de capacitación.");
  }

  const organizationId = String(formData.get("organizationId") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const scenario = String(formData.get("scenario") ?? "").trim() || null;
  const visibilityRaw = String(formData.get("visibility") ?? "").trim();

  const visibility = Object.values(TrainingRoomVisibility).includes(
    visibilityRaw as TrainingRoomVisibility,
  )
    ? (visibilityRaw as TrainingRoomVisibility)
    : TrainingRoomVisibility.org;

  if (!organizationId || !name) {
    fail("Completa organización y nombre de sala.");
  }

  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, displayName: true },
  });

  if (!organization) {
    fail("La organización seleccionada ya no existe.");
  }

  const targetOrganization = organization;

  const room = await prisma.trainingRoom.create({
    data: {
      organizationId,
      name,
      description,
      scenario,
      visibility,
      createdBy: admin.id,
      members: {
        create: {
          userId: admin.id,
          role: "facilitator",
          accessRole: "moderator",
          isAnonymous: false,
        },
      },
    },
    select: {
      id: true,
      name: true,
      visibility: true,
    },
  });

  await writeAdminAuditLog({
    module: AdminConfigModule.ACCESS,
    action: AdminAuditAction.CREATE,
    actor: admin,
    entityType: "training.room",
    entityId: room.id,
    after: {
      organizationId,
      name,
      description,
      scenario,
      visibility,
    },
    message: `Se creó la sala ${room.name} en ${targetOrganization.displayName}.`,
  });

  revalidatePath("/admin/capacitacion");
  revalidatePath("/unidep/capacitacion");
  revalidatePath("/unidep/capacitacion/rolplay");
  success("Sala creada correctamente.");
}

export async function assertTrainingAdminView() {
  const admin = await requireAdminAccessUser();
  if (!canViewTrainingAdmin(admin.capabilities)) {
    redirect("/auth/denied?reason=missing-admin-capability");
  }
  return admin;
}
