(function attachRecalcAnonymousAnalytics(globalScope) {
  const APP_BASE_URL = "https://recalc.relead.com.mx";
  const PROFILE_KEY = "recalc.senderProfile";
  const EVENTS_KEY = "recalc.senderAnalyticsEvents";
  const CAMPAIGNS_KEY = "recalc.localCampaigns";

  function randomUuid() {
    if (globalScope.crypto?.randomUUID) return globalScope.crypto.randomUUID();
    const bytes = new Uint8Array(16);
    globalScope.crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 15) | 64;
    bytes[8] = (bytes[8] & 63) | 128;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  function randomProof() {
    const bytes = new Uint8Array(32);
    globalScope.crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  function normalizeNameId(value) {
    return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
  }

  async function getProfile() {
    const data = await globalScope.chrome.storage.local.get([PROFILE_KEY]);
    const profile = data?.[PROFILE_KEY];
    return profile?.nameId && profile?.installationId && profile?.installationProof ? profile : null;
  }

  async function saveProfile(nameId) {
    const normalized = normalizeNameId(nameId);
    if (normalized.length < 2) throw new Error("El Name_ID debe tener al menos 2 caracteres.");
    const current = await getProfile();
    const profile = {
      nameId: normalized,
      installationId: current?.installationId || randomUuid(),
      installationProof: current?.installationProof || randomProof(),
      createdAt: current?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      registeredAt: current?.registeredAt || null,
      lastSyncAt: current?.lastSyncAt || null,
    };
    await globalScope.chrome.storage.local.set({ [PROFILE_KEY]: profile });
    return profile;
  }

  async function registerInstallation(profile = null) {
    const current = profile || await getProfile();
    if (!current) return { ok: false, skipped: true };
    try {
      const response = await fetch(`${APP_BASE_URL}/api/ext/analytics/installations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          installationId: current.installationId,
          installationProof: current.installationProof,
          nameId: current.nameId,
          extensionVersion: globalScope.chrome.runtime.getManifest().version,
          clientMeta: { platform: globalScope.navigator?.platform || null, mode: "offline_first" },
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) return { ok: false, error: data?.error || `HTTP ${response.status}` };
      const next = { ...current, registeredAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      await globalScope.chrome.storage.local.set({ [PROFILE_KEY]: next });
      return { ok: true, profile: next };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "analytics_unavailable" };
    }
  }

  async function queueEvent(eventType, payload = null, campaignId = null, recipientId = null) {
    const data = await globalScope.chrome.storage.local.get([EVENTS_KEY]);
    const current = Array.isArray(data?.[EVENTS_KEY]) ? data[EVENTS_KEY] : [];
    const next = [...current, {
      id: randomUuid(),
      campaignId: campaignId || null,
      recipientId: recipientId || null,
      eventType: String(eventType || "event").slice(0, 80),
      occurredAt: new Date().toISOString(),
      payload,
    }].slice(-200);
    await globalScope.chrome.storage.local.set({ [EVENTS_KEY]: next });
  }

  function campaignSnapshot(campaign) {
    const recipients = Array.isArray(campaign?.recipients) ? campaign.recipients : [];
    const count = (status) => recipients.filter((item) => item.status === status).length;
    return {
      id: campaign.id,
      campaignName: campaign.campaignName || "Campaña local",
      status: campaign.status || "queued",
      messageTemplate: campaign.messageTemplate || "",
      scheduleAt: campaign.scheduleAt || null,
      startedAt: campaign.startedAt || null,
      completedAt: campaign.completedAt || null,
      batchSize: Number(campaign.batchSize || 25),
      messageDelayMs: Number(campaign.messageDelayMs || 4000),
      batchDelayMs: Number(campaign.meta?.batchDelayMs || 0),
      jitterMs: Number(campaign.meta?.jitterMs || 0),
      hasMedia: Boolean(campaign.mediaDraftId),
      mediaType: campaign.mediaType || null,
      totalCount: recipients.length,
      sentCount: count("sent"),
      failedCount: count("failed"),
      pendingCount: recipients.filter((item) => ["queued", "claimed", "scheduled"].includes(item.status)).length,
      invalidCount: count("invalid"),
      estimatedCostMxn: Number(campaign.estimatedCostMxn || 0),
      country: campaign.country || null,
      settings: campaign.settings || null,
      meta: { ...(campaign.meta || {}), source: "chrome_extension_local" },
      createdAt: campaign.createdAt || null,
      updatedAt: campaign.updatedAt || null,
    };
  }

  function recipientSnapshot(campaign, recipient) {
    return {
      id: recipient.id,
      campaignId: campaign.id,
      contactValue: recipient.contactValue,
      contactName: recipient.contactName || null,
      status: recipient.status || "queued",
      resolvedMessage: recipient.resolvedMessage || null,
      attemptedAt: recipient.attemptedAt || null,
      sentAt: recipient.sentAt || null,
      failedAt: recipient.failedAt || null,
      lastError: recipient.lastError || null,
      payload: recipient.payload || null,
      createdAt: recipient.createdAt || campaign.createdAt || null,
      updatedAt: recipient.updatedAt || campaign.updatedAt || null,
    };
  }

  async function syncCampaigns(campaigns = null) {
    const profile = await getProfile();
    if (!profile) return { ok: false, skipped: true };
    const stored = await globalScope.chrome.storage.local.get([CAMPAIGNS_KEY, EVENTS_KEY]);
    const source = Array.isArray(campaigns)
      ? campaigns
      : (Array.isArray(stored?.[CAMPAIGNS_KEY]) ? stored[CAMPAIGNS_KEY] : []);
    const selected = source.slice(0, 20);
    const recipients = selected.flatMap((campaign) =>
      (Array.isArray(campaign.recipients) ? campaign.recipients : []).map((recipient) => recipientSnapshot(campaign, recipient)),
    ).slice(0, 500);
    try {
      const response = await fetch(`${APP_BASE_URL}/api/ext/analytics/sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Recalc-Installation-Id": profile.installationId,
          "X-Recalc-Installation-Proof": profile.installationProof,
          "X-Extension-Version": globalScope.chrome.runtime.getManifest().version,
        },
        cache: "no-store",
        body: JSON.stringify({
          nameId: profile.nameId,
          extensionVersion: globalScope.chrome.runtime.getManifest().version,
          clientMeta: { mode: "offline_first" },
          campaigns: selected.map(campaignSnapshot),
          recipients,
          events: (Array.isArray(stored?.[EVENTS_KEY]) ? stored[EVENTS_KEY] : []).slice(-250),
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) return { ok: false, error: data?.error || `HTTP ${response.status}` };
      await globalScope.chrome.storage.local.set({
        [PROFILE_KEY]: { ...profile, lastSyncAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        [EVENTS_KEY]: [],
      });
      return { ok: true, sync: data.sync || null };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "analytics_unavailable" };
    }
  }

  globalScope.RecalcAnonymousAnalytics = {
    PROFILE_KEY,
    EVENTS_KEY,
    CAMPAIGNS_KEY,
    randomUuid,
    normalizeNameId,
    getProfile,
    saveProfile,
    registerInstallation,
    queueEvent,
    syncCampaigns,
  };
})(typeof self !== "undefined" ? self : window);
