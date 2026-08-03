import { expect, test } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const EXTENSION_DIR = path.join(process.cwd(), "chrome-extension", "variants", "preview-first");
const PANEL_HTML_PATH = path.join(EXTENSION_DIR, "panel-offline.html");
const CAMPAIGNS_SCRIPT_PATH = path.join(EXTENSION_DIR, "campaigns-local.js");

test("elimina una campaña pausada y limpia su runner y multimedia", async ({ page }) => {
  const panelHtml = (await fs.readFile(PANEL_HTML_PATH, "utf8"))
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");

  await page.route("https://recalc.test/panel", async (route) => {
    await route.fulfill({ status: 200, contentType: "text/html", body: panelHtml });
  });
  await page.goto("https://recalc.test/panel");

  await page.evaluate(() => {
    const campaign = {
      id: "campaign-paused-1",
      campaignName: "Campaña pausada de prueba",
      status: "paused",
      messageTemplate: "Prueba",
      scheduleAt: null,
      messageDelayMs: 4000,
      estimatedCostMxn: 0,
      mediaDraftId: "draft-paused-media",
      mediaType: "image/png",
      updatedAt: new Date().toISOString(),
      recipients: [
        {
          id: "recipient-1",
          contactName: "Ricardo",
          contactValue: "5215580363387",
          status: "queued",
        },
      ],
      meta: { nameId: "TEST", batchDelayMs: 0 },
    };
    const runner = {
      runId: "run-paused-1",
      campaignId: campaign.id,
      campaignName: campaign.campaignName,
      enabled: true,
      paused: true,
      busy: false,
      status: "paused",
      lastMessage: "La campaña quedó en pausa.",
    };
    const storage: Record<string, unknown> = {
      "recalc.localCampaigns": [campaign],
      "recalc.activeCampaignRunner": runner,
    };
    const messages: unknown[] = [];
    const clearedDrafts: string[] = [];

    Object.assign(window, {
      fixtureState: { storage, messages, clearedDrafts },
      RecalcAnonymousAnalytics: {
        CAMPAIGNS_KEY: "recalc.localCampaigns",
        randomUuid: () => `uuid-${Math.random()}`,
        getProfile: async () => ({ nameId: "TEST" }),
        queueEvent: async () => undefined,
        syncCampaigns: async () => undefined,
      },
      RecalcAttachmentStore: {
        formatBytes: () => "1 KB",
        saveAttachments: async () => ({ saved: [], rejected: [] }),
        getAttachments: async () => [],
        clearAttachments: async (draftId: string) => { clearedDrafts.push(draftId); },
      },
      chrome: {
        storage: {
          local: {
            get: async (keys: string[]) => Object.fromEntries(keys.map((key) => [key, storage[key]])),
            set: async (values: Record<string, unknown>) => { Object.assign(storage, structuredClone(values)); },
            remove: async (keys: string[]) => { keys.forEach((key) => delete storage[key]); },
          },
          onChanged: { addListener: () => undefined },
        },
        runtime: {
          lastError: null,
          sendMessage: (message: { type?: string; runId?: string; campaignId?: string }, callback: (value: unknown) => void) => {
            messages.push(structuredClone(message));
            if (message.type === "GET_CAMPAIGN_RUNNER_STATUS") {
              callback({ ok: true, runner: storage["recalc.activeCampaignRunner"] ?? null });
              return;
            }
            if (message.type === "CLEAR_CAMPAIGN_RUNNER") {
              const current = storage["recalc.activeCampaignRunner"] as { runId?: string; campaignId?: string; paused?: boolean } | undefined;
              if (!current?.paused || current.runId !== message.runId || current.campaignId !== message.campaignId) {
                callback({ ok: false, error: "Runner no eliminable" });
                return;
              }
              delete storage["recalc.activeCampaignRunner"];
              callback({ ok: true, runner: null });
              return;
            }
            callback({ ok: true, runner: storage["recalc.activeCampaignRunner"] ?? null });
          },
        },
      },
    });
  });

  await page.addScriptTag({ path: CAMPAIGNS_SCRIPT_PATH });
  await page.evaluate(() => document.dispatchEvent(new Event("DOMContentLoaded")));

  await expect(page.locator("#campaign-list .campaign-item")).toHaveCount(1);
  await page.locator('[data-tab-target="reports-panel"]').click();
  await page.locator("#campaign-delete-selected").click();
  await expect(page.locator("#campaign-list .campaign-item")).toHaveCount(0);
  await expect(page.locator("#campaign-feedback")).toContainText("Campaña eliminada");

  const result = await page.evaluate(() => {
    const state = (window as typeof window & {
      fixtureState: {
        storage: Record<string, unknown>;
        messages: Array<{ type?: string; campaignId?: string }>;
        clearedDrafts: string[];
      };
    }).fixtureState;
    return {
      campaigns: state.storage["recalc.localCampaigns"],
      runner: state.storage["recalc.activeCampaignRunner"] ?? null,
      messageTypes: state.messages.map((message) => message.type),
      clearCampaignId: state.messages.find((message) => message.type === "CLEAR_CAMPAIGN_RUNNER")?.campaignId ?? null,
      clearedDrafts: state.clearedDrafts,
    };
  });

  expect(result.campaigns).toEqual([]);
  expect(result.runner).toBeNull();
  expect(result.messageTypes).toContain("CLEAR_CAMPAIGN_RUNNER");
  expect(result.clearCampaignId).toBe("campaign-paused-1");
  expect(result.clearedDrafts).toContain("draft-paused-media");
});
