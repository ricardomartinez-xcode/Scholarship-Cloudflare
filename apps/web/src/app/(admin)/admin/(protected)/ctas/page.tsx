import { AdminCapability, AdminConfigModule } from "@prisma/client";

import ConfigPublishPanel from "@/components/admin/ConfigPublishPanel";
import { getAdminUser, requireAdminCapabilityUser } from "@/lib/admin-session";
import { getAdminConfigModuleMeta } from "@/lib/admin-config-modules";
import { canPublishConfigWithAdmin } from "@/lib/admin-publish-auth";
import { getConfigPublicationState } from "@/lib/admin-config-snapshots";
import { resolveVisibilityRule } from "@/lib/admin-placement";
import { prisma } from "@/lib/prisma";
import CtasClient from "@/components/admin/CtasClient";
import { ALL_USER_CAPABILITIES, USER_CAPABILITY_META } from "@/lib/user-capabilities";
import {
  publishConfigModuleAction,
  rollbackConfigVersionAction,
} from "../config-actions";
import { deletePublicCtaAction, upsertPublicCtaAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function CtasPage() {
  await requireAdminCapabilityUser(AdminCapability.view_admin_operations);
  await requireAdminCapabilityUser(AdminCapability.manage_ctas);
  const configModule = AdminConfigModule.CTAS;
  const moduleMeta = getAdminConfigModuleMeta(configModule);

  const [admin, publicationState, ctas, organizations] = await Promise.all([
    getAdminUser(),
    getConfigPublicationState(configModule),
    prisma.adminPublicCta.findMany({
      orderBy: [{ location: "asc" }, { sortOrder: "asc" }, { updatedAt: "desc" }],
      select: {
        id: true,
        label: true,
        kind: true,
        location: true,
        url: true,
        isActive: true,
        sortOrder: true,
        variant: true,
        organizationId: true,
        onlyNewUsers: true,
        requiredCapability: true,
        visibilityRule: true,
      },
    }),
    prisma.organization.findMany({
      where: { isActive: true },
      orderBy: { displayName: "asc" },
      select: { id: true, displayName: true },
    }),
  ]);

  const userCapabilityCatalog = ALL_USER_CAPABILITIES.map((key) => ({
    key,
    label:
      key in USER_CAPABILITY_META
        ? USER_CAPABILITY_META[key as keyof typeof USER_CAPABILITY_META].label
        : key,
  }));

  return (
    <div className="grid gap-6">
      <ConfigPublishPanel
        module={configModule}
        title={moduleMeta.label}
        description={moduleMeta.description}
        canPublish={canPublishConfigWithAdmin(admin)}
        state={publicationState}
        publishConfigModuleAction={publishConfigModuleAction}
        rollbackConfigVersionAction={rollbackConfigVersionAction}
      />
      <CtasClient
        ctas={ctas.map((cta) => {
          const visibility = resolveVisibilityRule(cta.visibilityRule);
          return {
            ...cta,
            excludeOrganizationIds: visibility.excludeOrganizationIds ?? [],
            excludeRoles: visibility.excludeRoles ?? [],
            excludeCapabilities: visibility.excludeCapabilities ?? [],
            excludeUserIds: visibility.excludeUserIds ?? [],
          };
        })}
        organizations={organizations}
        userCapabilityCatalog={userCapabilityCatalog}
        upsertPublicCtaAction={upsertPublicCtaAction}
        deletePublicCtaAction={deletePublicCtaAction}
      />
    </div>
  );
}
