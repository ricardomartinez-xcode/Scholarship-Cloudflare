import { AdminCapability, AdminConfigModule } from "@prisma/client";

import ConfigPublishPanel from "@/components/admin/ConfigPublishPanel";
import { getAdminUser, requireAdminCapabilityUser } from "@/lib/admin-session";
import { getAdminConfigModuleMeta } from "@/lib/admin-config-modules";
import { canPublishConfigWithAdmin } from "@/lib/admin-publish-auth";
import { getConfigPublicationState } from "@/lib/admin-config-snapshots";
import { prisma } from "@/lib/prisma";
import PricesClient from "@/components/admin/PricesClient";
import {
  publishConfigModuleAction,
  rollbackConfigVersionAction,
} from "../config-actions";
import {
  deletePriceOverrideAction,
  getBecaRules,
  upsertMontoOverrideAction,
} from "./actions";

import styles from "./PricesAdminSkin.module.css";

export const dynamic = "force-dynamic";

export default async function PricesPage() {
  await requireAdminCapabilityUser(AdminCapability.manage_prices);
  const configModule = AdminConfigModule.PRICES;
  const moduleMeta = getAdminConfigModuleMeta(configModule);

  const [admin, publicationState, becaRules, montoOverrides] = await Promise.all([
    getAdminUser(),
    getConfigPublicationState(configModule),
    getBecaRules(),
    prisma.adminPriceOverride.findMany({
      where: { scope: "base_price", isActive: true },
      select: { id: true, targetKeys: true, newPrice: true, isActive: true },
    }),
  ]);

  return (
    <div className={`${styles.priceSkin} grid gap-6`}>
      <ConfigPublishPanel
        module={configModule}
        title={moduleMeta.label}
        description={moduleMeta.description}
        canPublish={canPublishConfigWithAdmin(admin)}
        state={publicationState}
        publishConfigModuleAction={publishConfigModuleAction}
        rollbackConfigVersionAction={rollbackConfigVersionAction}
      />
      <PricesClient
        becaRules={becaRules}
        montoOverrides={montoOverrides}
        upsertMontoOverrideAction={upsertMontoOverrideAction}
        deletePriceOverrideAction={deletePriceOverrideAction}
      />
    </div>
  );
}
