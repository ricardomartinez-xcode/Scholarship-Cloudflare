const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const runnerSource = fs.readFileSync(
  path.join(__dirname, "..", "lib", "campaigns", "runCampaign.js"),
  "utf8",
);

function createHarness() {
  const store = {};
  const alarmEvents = [];
  const chrome = {
    storage: {
      local: {
        async get(keys) {
          const result = {};
          for (const key of Array.isArray(keys) ? keys : [keys]) {
            result[key] = store[key];
          }
          return result;
        },
        async set(values) {
          Object.assign(store, values);
        },
        async remove(keys) {
          for (const key of Array.isArray(keys) ? keys : [keys]) {
            delete store[key];
          }
        },
      },
    },
    alarms: {
      async clear(name) {
        alarmEvents.push({ type: "clear", name });
      },
      async create(name, options) {
        alarmEvents.push({ type: "create", name, options });
      },
    },
  };
  const context = { chrome, console, Date, Math, setTimeout, clearTimeout };
  context.self = context;
  context.window = context;
  vm.createContext(context);
  vm.runInContext(runnerSource, context, { filename: "runCampaign.js" });
  return { runner: context.RecalcCampaignRunner, store, alarmEvents };
}

function createBatch() {
  return {
    campaign: {
      id: "campaign_1",
      campaignName: "Prueba media",
      messageDelayMs: 1000,
      messageTemplate: "Hola con imagen",
      meta: {
        batchDelayMs: 500,
        jitterMs: 0,
      },
    },
    recipients: [
      {
        id: "recipient_1",
        contactName: "Destino",
        contactValue: "5573578665",
        resolvedMessage: "Hola con imagen",
      },
    ],
  };
}

test("does not send WhatsApp twice when a sent recipient is reclaimed after report failure", async () => {
  const { runner } = createHarness();
  await runner.runCampaign({
    campaignId: "campaign_1",
    appBaseUrl: "https://recalc.test",
    extensionSessionToken: "token",
  });

  let sendCalls = 0;
  let reportCalls = 0;
  const deps = {
    async claimNextBatch() {
      return createBatch();
    },
    async loadCampaignById() {
      return { id: "campaign_1", status: "running", campaignName: "Prueba media" };
    },
    async reportDispatch() {
      reportCalls += 1;
      if (reportCalls === 1) {
        throw new Error("backend temporalmente caido");
      }
      return { status: "completed", campaignName: "Prueba media" };
    },
    async ensureWhatsAppTab() {
      return 123;
    },
    async ensureWhatsAppBridge() {},
    resolveMessage(_working, recipient) {
      return recipient.resolvedMessage;
    },
    async getAttachmentsForCampaign() {
      return [{ name: "test.jpg", type: "image/jpeg", size: 3, bytes: [1, 2, 3] }];
    },
    async sendToWhatsApp() {
      sendCalls += 1;
      return { success: true, delayMs: 1000 };
    },
  };

  await runner.processTick(deps);
  await runner.processTick(deps);

  assert.equal(sendCalls, 1);
  assert.equal(reportCalls, 2);
});

test("opens WhatsApp with campaign text prefilled when sending media so it becomes the caption", async () => {
  const { runner } = createHarness();
  await runner.runCampaign({
    campaignId: "campaign_1",
    appBaseUrl: "https://recalc.test",
    extensionSessionToken: "token",
  });

  const ensureCalls = [];
  const deps = {
    async claimNextBatch() {
      return createBatch();
    },
    async loadCampaignById() {
      return { id: "campaign_1", status: "running", campaignName: "Prueba media" };
    },
    async reportDispatch() {
      return { status: "running", campaignName: "Prueba media" };
    },
    async ensureWhatsAppTab(input) {
      ensureCalls.push(input);
      return 123;
    },
    async ensureWhatsAppBridge() {},
    resolveMessage(_working, recipient) {
      return recipient.resolvedMessage;
    },
    async getAttachmentsForCampaign() {
      return [{ name: "test.jpg", type: "image/jpeg", size: 3, bytes: [1, 2, 3] }];
    },
    async sendToWhatsApp() {
      return { success: true, delayMs: 1000 };
    },
  };

  await runner.processTick(deps);

  assert.equal(ensureCalls.length, 1);
  assert.equal(ensureCalls[0].phone, "5573578665");
  assert.equal(ensureCalls[0].text, "Hola con imagen");
});

test("opens WhatsApp without URL draft for text-only campaigns", async () => {
  const { runner } = createHarness();
  await runner.runCampaign({
    campaignId: "campaign_1",
    appBaseUrl: "https://recalc.test",
    extensionSessionToken: "token",
  });

  const ensureCalls = [];
  const deps = {
    async claimNextBatch() {
      return createBatch();
    },
    async loadCampaignById() {
      return { id: "campaign_1", status: "running", campaignName: "Prueba media" };
    },
    async reportDispatch() {
      return { status: "running", campaignName: "Prueba media" };
    },
    async ensureWhatsAppTab(input) {
      ensureCalls.push(input);
      return 123;
    },
    async ensureWhatsAppBridge() {},
    resolveMessage(_working, recipient) {
      return recipient.resolvedMessage;
    },
    async getAttachmentsForCampaign() {
      return [];
    },
    async sendToWhatsApp() {
      return { success: true, delayMs: 1000 };
    },
  };

  await runner.processTick(deps);

  assert.equal(ensureCalls.length, 1);
  assert.equal(ensureCalls[0].phone, "5573578665");
  assert.equal(ensureCalls[0].text, "");
});

test("stops runner instead of retrying when campaign API rejects the session token", async () => {
  const { runner, alarmEvents } = createHarness();
  await runner.runCampaign({
    campaignId: "campaign_1",
    appBaseUrl: "https://recalc.test",
    extensionSessionToken: "expired-token",
  });

  const deps = {
    async claimNextBatch() {
      const error = new Error("La sesión de la extensión expiró.");
      error.authFailure = true;
      throw error;
    },
    async loadCampaignById() {
      throw new Error("No debe intentar leer la campaña después del fallo de sesión.");
    },
    async reportDispatch() {
      throw new Error("No debe reportar despacho después del fallo de sesión.");
    },
    async ensureWhatsAppTab() {
      throw new Error("No debe abrir WhatsApp después del fallo de sesión.");
    },
    async ensureWhatsAppBridge() {},
    resolveMessage() {
      return "";
    },
    async getAttachmentsForCampaign() {
      return [];
    },
    async sendToWhatsApp() {
      throw new Error("No debe enviar WhatsApp después del fallo de sesión.");
    },
  };

  await runner.processTick(deps);

  const state = await runner.getState();
  assert.equal(state.enabled, false);
  assert.equal(state.busy, false);
  assert.equal(state.status, "stopped");
  assert.equal(state.lastMessage, "La sesión de la extensión expiró.");
  assert.equal(
    alarmEvents.some((event) => event.type === "clear" && event.name === runner.RUNNER_ALARM),
    true,
  );
});
