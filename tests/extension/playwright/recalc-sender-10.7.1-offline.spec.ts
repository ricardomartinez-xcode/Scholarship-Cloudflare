import { expect, test } from "@playwright/test";
import path from "node:path";
import { pathToFileURL } from "node:url";

const panelUrl = pathToFileURL(
  path.resolve(process.cwd(), "chrome-extension/variants/preview-first/panel-offline.html"),
).toString();

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const store: Record<string, unknown> = {};
    const fetchCalls: string[] = [];
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
          return { version: "10.7.2" };
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
    Object.defineProperty(window, "__recalcFetchCalls", { value: fetchCalls, configurable: true });
    window.fetch = async (input) => {
      const url = String(input);
      fetchCalls.push(url);
      const online = new URL(window.location.href).searchParams.get("analytics") === "online";
      if (!online) {
        return new Response(JSON.stringify({ ok: false, error: "Servicio de ReCalc no disponible" }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url.includes("/installations")) {
        return new Response(JSON.stringify({ ok: true, installation: { status: "active" } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ ok: true, sync: { campaigns: 0, recipients: 0 } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };
  });
});

test("separa el runner local y muestra el error real cuando ReCalc no responde", async ({ page }) => {
  await page.goto(panelUrl);

  await expect(page.getByText("Configura tu Name_ID")).toBeVisible();
  await expect(page.getByText("Inicia sesión")).toHaveCount(0);
  await expect(page.getByText("Cotizador")).toHaveCount(0);

  await page.getByLabel("Name_ID").fill("Ricardo_UNIDEP");
  await page.getByRole("button", { name: "Continuar" }).click();

  await expect(page.getByText("Runner: local", { exact: true })).toBeVisible();
  await expect(page.locator("#status-pill")).toHaveText("ReCalc sin conexión");
  await expect(page.locator("#recalc-connection-status")).toHaveText("Sin conexión");
  await expect(page.locator("#analytics-status")).toHaveText("Runner local activo");
  await expect(page.locator("#recalc-sync-error")).toContainText("Servicio de ReCalc no disponible");
  await expect(page.getByRole("button", { name: "Sincronizar con ReCalc" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Campañas" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Resultados" })).toBeVisible();

  const savedNameId = await page.evaluate(() => {
    const store = (window as typeof window & { __recalcTestStore: Record<string, any> }).__recalcTestStore;
    return store["recalc.senderProfile"]?.nameId ?? null;
  });
  expect(savedNameId).toBe("Ricardo_UNIDEP");
});

test("registra, sincroniza y permite forzar una nueva sincronización con ReCalc", async ({ page }) => {
  await page.goto(`${panelUrl}?analytics=online`);
  await page.getByLabel("Name_ID").fill("Ricardo_UNIDEP");
  await page.getByRole("button", { name: "Continuar" }).click();

  await expect(page.locator("#status-pill")).toHaveText("ReCalc conectado");
  await expect(page.locator("#recalc-connection-status")).toHaveText("Conectado");
  await expect(page.locator("#analytics-status")).toHaveText("Sincronizado");
  await expect(page.locator("#recalc-sync-detail")).toContainText("Última sincronización:");
  await expect(page.locator("#recalc-sync-error")).toBeHidden();

  const syncButton = page.getByRole("button", { name: "Sincronizar con ReCalc" });
  const before = await page.evaluate(() => (
    window as typeof window & { __recalcFetchCalls: string[] }
  ).__recalcFetchCalls.length);
  await syncButton.click();
  await expect(page.locator("#status-pill")).toHaveText("ReCalc conectado");
  const after = await page.evaluate(() => (
    window as typeof window & { __recalcFetchCalls: string[] }
  ).__recalcFetchCalls.length);
  expect(after).toBeGreaterThanOrEqual(before + 2);
});
