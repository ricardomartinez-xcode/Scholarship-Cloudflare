import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const base = "chrome-extension/variants/preview-first";
const panelHtml = fs.readFileSync(`${base}/panel-offline.html`, "utf8");
const panelJs = fs.readFileSync(`${base}/panel-offline.js`, "utf8");
const campaignsJs = fs.readFileSync(`${base}/campaigns-local.js`, "utf8");
const analyticsJs = fs.readFileSync(`${base}/lib/analytics.js`, "utf8");
const backgroundJs = fs.readFileSync(`${base}/background-offline.js`, "utf8");
const manifest = JSON.parse(fs.readFileSync(`${base}/manifest.json`, "utf8"));

assert.equal(manifest.name, "ReCalc Sender");
assert.equal(manifest.version, "10.7.1");
assert.match(manifest.description, /offline-first/i);
assert.match(manifest.description, /sin inicio de sesión/i);

for (const forbidden of ["auth-view", "auth-form", "Inicia sesión", "Cotizador", "quote-panel"]) {
  assert.ok(!panelHtml.includes(forbidden), `panel.html must not include ${forbidden}`);
}
assert.match(panelHtml, /Configura tu Name_ID/);
assert.match(panelHtml, /data-tab-target="campaign-panel"/);
assert.match(panelHtml, /data-tab-target="reports-panel"/);
assert.match(panelHtml, /campaigns-local\.js/);
assert.ok(!panelHtml.includes("campaigns.js"));
assert.ok(!panelJs.includes("/api/extension/auth"));
assert.ok(!panelJs.includes("extensionSessionToken"));
assert.match(analyticsJs, /recalc\.localCampaigns/);
assert.match(campaignsJs, /analytics\.CAMPAIGNS_KEY/);
assert.match(campaignsJs, /RecalcAttachmentStore/);
assert.match(backgroundJs, /const LOCAL_CAMPAIGNS_KEY = "recalc\.localCampaigns"/);
assert.match(backgroundJs, /RecalcAttachmentStore\.getAttachments/);

const htmlIds = new Set([...panelHtml.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]));
const referencedIds = new Set([...campaignsJs.matchAll(/getElementById\("([^"]+)"\)/g)].map((match) => match[1]));
for (const id of referencedIds) {
  assert.ok(htmlIds.has(id), `campaigns-local.js references missing #${id}`);
}

const storage = {};
const alarms = [];
const chrome = {
  storage: {
    local: {
      async get(keys) {
        return Object.fromEntries(keys.map((key) => [key, storage[key]]));
      },
      async set(values) {
        Object.assign(storage, structuredClone(values));
      },
      async remove(keys) {
        for (const key of keys) delete storage[key];
      },
    },
  },
  alarms: {
    async clear(name) {
      alarms.push({ type: "clear", name });
      return true;
    },
    async create(name, options) {
      alarms.push({ type: "create", name, options });
    },
  },
};
const context = { self: {}, chrome, console, Date, setTimeout, clearTimeout };
vm.createContext(context);
vm.runInContext(fs.readFileSync(`${base}/lib/campaigns/runCampaign-offline.js`, "utf8"), context);
const runner = context.self.RecalcCampaignRunner;
const started = await runner.runCampaign({ campaignId: "local-campaign", campaignName: "Local" });
assert.equal(started.campaignId, "local-campaign");
assert.equal(started.enabled, true);
assert.equal(started.paused, false);
assert.equal(storage[runner.ACTIVE_RUNNER_KEY].campaignId, "local-campaign");
assert.ok(alarms.some((entry) => entry.type === "create"), "runner should schedule without a token");

console.log("PASS ReCalc Sender 10.7.1: no auth, no quote calculator, local runner and Name_ID setup");
