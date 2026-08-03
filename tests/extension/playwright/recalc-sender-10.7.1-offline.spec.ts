import { expect, test } from "@playwright/test";
import path from "node:path";
import { pathToFileURL } from "node:url";

const panelUrl = pathToFileURL(
  path.resolve(process.cwd(), "chrome-extension/variants/preview-first/panel-offline.html"),
).toString();

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const store: Record<string, unknown> = {};
    const chromeMock = {
      storage: {
        local: {
          async get(keys: string[]) {
            return Object.fromEntries(keys.map((key) => [key, store[key]]));
          },
          async set(values: Record<string, unknown>) {
            Object.assign(store, structuredClone(values));
          },
          async remove(keys: string[]) {
            for (const key of keys) delete store[key];
          },
        },
        onChanged: { addListener() {} },
      },
      runtime: {
        getManifest() {
          return { version: "10.7.1" };
        },
        sendMessage(message: { type?: string }, callback: (value: unknown) => void) {
          if (message.type === "GET_CAMPAIGN_RUNNER_STATUS") callback({ ok: true, runner: null });
          else callback({ ok: true });
        },
        lastError: null,
      },
      tabs: { create() {} },
    };
    Object.defineProperty(window, "chrome", { value: chromeMock, configurable: true });
    Object.defineProperty(window, "__recalcTestStore", { value: store, configurable: true });
    window.fetch = async () => new Response(JSON.stringify({ ok: false, error: "offline" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  });
});

test("first use requires only Name_ID and remains usable with analytics offline", async ({ page }) => {
  await page.goto(panelUrl);

  await expect(page.getByText("Configura tu Name_ID")).toBeVisible();
  await expect(page.getByText("Inicia sesión")).toHaveCount(0);
  await expect(page.getByText("Cotizador")).toHaveCount(0);

  await page.getByLabel("Name_ID").fill("Ricardo_UNIDEP");
  await page.getByRole("button", { name: "Continuar" }).click();

  await expect(page.getByText("Modo local")).toBeVisible();
  await expect(page.getByRole("button", { name: "Campañas" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Resultados" })).toBeVisible();
  await expect(page.getByText("Ricardo_UNIDEP", { exact: true })).toBeVisible();

  const savedNameId = await page.evaluate(() => {
    const store = (window as typeof window & { __recalcTestStore: Record<string, any> }).__recalcTestStore;
    return store["recalc.senderProfile"]?.nameId ?? null;
  });
  expect(savedNameId).toBe("Ricardo_UNIDEP");
});
