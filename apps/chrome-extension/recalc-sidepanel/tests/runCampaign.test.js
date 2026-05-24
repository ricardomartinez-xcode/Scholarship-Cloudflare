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
      async clear() {},
      async create() {},
    },
  };
  const context = { chrome, console, Date, Math, setTimeout, clearTimeout };
  context.self = context;
  context.window = context;
  vm.createContext(context);
  vm.runInContext(runnerSource, context, { filename: "runCampaign.js" });
  return { runner: context.RecalcCampaignRunner, store };
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
