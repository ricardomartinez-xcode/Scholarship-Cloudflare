import { describe, expect, it } from "vitest";

import { buildMetaOnboardingSummary } from "@/lib/meta-whatsapp";

const baseCapabilities = {
  canLaunchEmbeddedSignup: true,
  canSyncAssets: true,
  canListTemplates: true,
  canSendText: true,
  canSendTemplate: true,
  canUploadMedia: true,
  canSendConversions: true,
  canReviewBsuid: true,
  canReviewBusinessAssetProfile: true,
  businessManagementInScope: false,
};

describe("buildMetaOnboardingSummary", () => {
  it("marca blocked cuando no existe conexión ni activos", () => {
    const summary = buildMetaOnboardingSummary({
      connection: null,
      assets: {
        business: null,
        waba: null,
        phoneNumber: null,
        businessProfile: null,
      },
      templates: [],
      blockers: ["No WABA connection"],
      recentMessagesCount: 0,
      recentEventsCount: 0,
      capabilities: { ...baseCapabilities, canSendText: false },
    });

    expect(summary.status).toBe("blocked");
    expect(summary.phases.find((phase) => phase.key === "connect")?.status).toBe("pending");
    expect(summary.phases.find((phase) => phase.key === "provision")?.status).toBe("blocked");
  });

  it("marca ready cuando hay conexión, activos y evidencia operacional", () => {
    const summary = buildMetaOnboardingSummary({
      connection: {
        id: "conn-1",
        status: "connected",
        graphApiVersion: "v25.0",
        wabaId: "waba-1",
        wabaName: "WABA",
        phoneNumberId: "phone-1",
        phoneDisplayNumber: "+52 55 1234 5678",
        phoneVerifiedName: "Recalc",
        phoneQualityRating: "GREEN",
        phoneCodeVerificationStatus: "VERIFIED",
        businessAccountId: "biz-1",
        businessManagerId: null,
        businessName: "Recalc",
        wabaCurrency: "MXN",
        wabaTimezoneId: "1",
        accessTokenExpiresAt: null,
        connectedAt: new Date().toISOString(),
        lastAssetSyncAt: new Date().toISOString(),
        lastTemplateSyncAt: new Date().toISOString(),
        lastWebhookAt: new Date().toISOString(),
        lastSyncError: null,
        grantedScopes: [
          "whatsapp_business_messaging",
          "whatsapp_business_management",
        ],
        updatedAt: new Date().toISOString(),
      },
      assets: {
        business: { id: "biz-1", name: "Recalc" },
        waba: { id: "waba-1", name: "WABA", currency: "MXN", timezoneId: "1" },
        phoneNumber: {
          id: "phone-1",
          displayPhoneNumber: "+52 55 1234 5678",
          verifiedName: "Recalc",
          qualityRating: "GREEN",
          codeVerificationStatus: "VERIFIED",
        },
        businessProfile: null,
      },
      templates: [
        {
          id: "tpl-1",
          name: "welcome",
          language: "es",
          status: "APPROVED",
          category: "MARKETING",
          qualityScore: "GREEN",
          rejectedReason: null,
          updatedAt: new Date().toISOString(),
        },
      ],
      blockers: [],
      recentMessagesCount: 2,
      recentEventsCount: 1,
      capabilities: baseCapabilities,
    });

    expect(summary.status).toBe("ready");
    expect(summary.missingPermissions).toEqual([]);
    expect(summary.phases.every((phase) => phase.status === "ready")).toBe(true);
  });
});
