import { type Role } from "@prisma/client";

import { getExtensionPanelConfig } from "@/lib/extension-panel-config";
import { getQuoteMode } from "@/lib/runtime-modes";

export async function buildExtensionBootstrap(params: {
  user: {
    id: string;
    email: string;
    role: Role;
  };
}) {
  const panelConfig = await getExtensionPanelConfig();
  const quoteMode = getQuoteMode();

  return {
    ok: true as const,
    user: {
      id: params.user.id,
      email: params.user.email,
      role: params.user.role,
    },
    panelConfig,
    selectorPack: panelConfig.selectorPack,
    quoteMode,
    features: {
      liveQuote: true,
      panelConfigSync: true,
      whatsappWebShortcut: true,
      runTracking: true,
      selectorPackReady: true,
      whatsappTemplateDraft: true,
      whatsappDomInjection: true,
      campaignQueue: true,
      bulkDispatch: true,
      scheduledDispatch: true,
      campaignRecipientImport: true,
      campaignTemplateText: true,
      campaignMediaUrl: true,
      campaignDelayControl: true,
      campaignRunner: true,
      runnerHeartbeat: true,
      campaignReports: true,
      campaignPauseControl: true,
      campaignDeleteControl: true,
      campaignMediaUpload: true,
      contactsDirectory: false,
      contactsHybridSheets: false,
    },
    automationApi: {
      campaigns: "/api/ext/campaigns",
      claimBatch: "/api/ext/campaigns/claim",
      reportDispatch: "/api/ext/campaigns/:campaignId/dispatch",
      runnerHeartbeat: "/api/ext/runner/heartbeat",
      updateCampaign: "/api/ext/campaigns/:campaignId",
      deleteCampaign: "/api/ext/campaigns/:campaignId",
      uploadAsset: "/api/ext/campaigns/upload",
      mediaAsset: "/api/ext/campaigns/media",
    },
  };
}
