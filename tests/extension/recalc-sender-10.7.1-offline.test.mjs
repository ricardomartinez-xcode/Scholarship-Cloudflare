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
assert.equal(manifest.version, "10.7.2");
assert.match(manifest.description, /offline-first/i);
assert.match(manifest.description, /sin inicio de sesión/i);

for (const forbidden of ["auth-view", "auth-form", "Inicia sesión", "Cotizador", "quote-panel"]) {
  assert.ok(!panelHtml.includes(forbidden), `panel.html must not include ${forbidden}`);
}
assert.match(panelHtml, /Configura tu Name_ID/);
assert.match(panelHtml, /data-tab-target="campaign-panel"/);
assert.match(panelHtml, /data-tab-target="reports-panel"/);
assert.match(panelHtml, /campaigns-local\.js/);
assert.match(panelHtml, /id="sync-recalc"/);
assert.match(panelHtml, /id="recalc-connection-status"/);
assert.match(panelHtml, /Runner: local/);
assert.match(panelJs, /Sincronizar con ReCalc/);
assert.match(panelJs, /ReCalc sin conexión/);
assert.match(panelJs, /Última sincronización/);
assert.match(analyticsJs, /recalc-analytics-status/);
assert.match(analyticsJs, /emitStatus\("connected"/);
assert.ok(!panelHtml.includes("campaigns.js"));
assert.ok(!panelJs.includes("/api/extension/auth"));
assert.ok(!panelJs.includes("extensionSessionToken"));
assert.match(analyticsJs, /recalc\.localCampaigns/);
assert.match(campaignsJs, /analytics\.CAMPAIGNS_KEY/);
assert.match(campaignsJs, /RecalcAttachmentStore/);
assert.match(backgroundJs, /const LOCAL_CAMPAIGNS_KEY = "recalc\.localCampaigns"/);
assert.match(backgroundJs, /RecalcAttachmentStore\.getAttachments/);
assert.match(backgroundJs, /createTabNavigationWaiter/);
assert.match(backgroundJs, /requireNavigationEvent: true/);
assert.ok(!backgroundJs.includes("function waitForTabComplete"));

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

const navigationListeners = new Set();
let currentTab = { id: 77, url: "https://web.whatsapp.com/", status: "complete" };
let completedNavigation = false;
const navigationChrome = {
  sidePanel: { async setOptions() {}, async setPanelBehavior() {} },
  storage: {
    local: {
      async get() { return {}; },
      async set() {},
      async remove() {},
    },
  },
  tabs: {
    onUpdated: {
      addListener(listener) { navigationListeners.add(listener); },
      removeListener(listener) { navigationListeners.delete(listener); },
    },
    async query() { return [currentTab]; },
    async update(tabId, options) {
      assert.equal(tabId, 77);
      assert.match(options.url, /send\?phone=5215580363387/);
      const oldSnapshot = { ...currentTab };
      setTimeout(() => {
        currentTab = { id: 77, url: options.url, status: "loading" };
        for (const listener of navigationListeners) {
          listener(77, { url: options.url, status: "loading" }, currentTab);
        }
      }, 20);
      setTimeout(() => {
        completedNavigation = true;
        currentTab = { id: 77, url: "https://web.whatsapp.com/", status: "complete" };
        for (const listener of navigationListeners) {
          listener(77, { status: "complete" }, currentTab);
        }
      }, 50);
      return oldSnapshot;
    },
    async create() { throw new Error("not expected"); },
    get(_tabId, callback) { callback(currentTab); },
    sendMessage() {},
  },
  scripting: { async executeScript() { return []; } },
  runtime: {
    lastError: null,
    getManifest() { return { version: "10.7.2" }; },
    onInstalled: { addListener() {} },
    onStartup: { addListener() {} },
    onMessage: { addListener() {} },
  },
  alarms: {
    onAlarm: { addListener() {} },
  },
};
const navigationContext = {
  self: {
    RecalcCampaignRunner: { RUNNER_ALARM: "test", processTick() {} },
  },
  chrome: navigationChrome,
  console,
  URL,
  Date,
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  importScripts() {},
};
vm.createContext(navigationContext);
vm.runInContext(backgroundJs, navigationContext);
const tabId = await navigationContext.ensureWhatsAppTab({ phone: "5215580363387", text: "" });
assert.equal(tabId, 77);
assert.equal(completedNavigation, true, "must wait for the new WhatsApp navigation to complete");
assert.equal(navigationListeners.size, 0, "navigation listeners must be cleaned up");

console.log("PASS ReCalc Sender 10.7.2: connection UI, local runner and WhatsApp navigation race fixed");
