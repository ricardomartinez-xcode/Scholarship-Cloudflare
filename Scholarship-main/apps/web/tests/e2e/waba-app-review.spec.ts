import { mkdirSync } from "node:fs";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

import {
  loginAdmin,
  loginUser,
  requireAdminCredentials,
  requireUserCredentials,
} from "./helpers";

const auditRoot = path.join(process.cwd(), "meta-review-audit");
const screenshotDir = path.join(auditRoot, "screenshots");
const liveMetaEnvNames = [
  "META_APP_ID",
  "META_APP_SECRET",
  "META_INTEGRATION_SECRET",
  "NEXT_PUBLIC_META_APP_ID",
  "NEXT_PUBLIC_WHATSAPP_EMBEDDED_CONFIG_ID",
];

function ensureAuditDirs() {
  mkdirSync(screenshotDir, { recursive: true });
}

function missingEnv(names: string[]) {
  return names.filter((name) => !process.env[name]?.trim());
}

function getLiveReadBlockers() {
  const blockers = missingEnv(liveMetaEnvNames);
  if (process.env.E2E_WABA_EXPECT_CONNECTED !== "1") {
    blockers.push(
      "E2E_WABA_EXPECT_CONNECTED=1 is required to assert a reviewer account with a live WABA connection.",
    );
  }
  return blockers;
}

function getLiveSendBlockers() {
  const blockers = [...getLiveReadBlockers()];
  if (process.env.E2E_WABA_ENABLE_SEND !== "1") {
    blockers.push("E2E_WABA_ENABLE_SEND=1 is required before sending a real WhatsApp message.");
  }
  if (!process.env.E2E_WABA_CONTACT_ID?.trim()) {
    blockers.push("E2E_WABA_CONTACT_ID must point to a reviewer-safe contact row in the WABA tab.");
  }
  return blockers;
}

function getLiveMediaBlockers() {
  const blockers = [...getLiveSendBlockers()];
  if (process.env.E2E_WABA_ENABLE_MEDIA !== "1") {
    blockers.push("E2E_WABA_ENABLE_MEDIA=1 is required before uploading and sending live media.");
  }
  if (!process.env.E2E_WABA_MEDIA_FILE?.trim()) {
    blockers.push("E2E_WABA_MEDIA_FILE must be an absolute path to a safe reviewer media file.");
  }
  return blockers;
}

async function openWabaWorkspace(page: Page) {
  await page.goto("/unidep?tab=waba");
  await expect(page.getByTestId("waba-app-review")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("heading", { name: /Mensajes y seguimiento/i })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByTestId("waba-messages-panel")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("waba-events-panel")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("waba-contacts")).toBeVisible({ timeout: 30_000 });
}

async function openAdminWhatsapp(page: Page) {
  await page.goto("/admin/whatsapp");
  await expect(page.getByRole("heading", { name: /Consola técnica del canal/i })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByTestId("waba-app-review")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("waba-sync")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("waba-embedded-signup-connect-business")).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByTestId("waba-embedded-signup-connect-api")).toBeVisible({
    timeout: 30_000,
  });
}

async function saveStableScreenshot(page: Page, filename: string) {
  ensureAuditDirs();
  await page.screenshot({
    path: path.join(screenshotDir, filename),
    fullPage: true,
  });
}

test.describe("WABA app review surface", () => {
  test("loads the commercial WABA tab without exposing the technical admin console", async ({ page }) => {
    const { email, password } = requireUserCredentials();
    await loginUser(page, email, password);
    await openWabaWorkspace(page);

    await expect(page.getByTestId("waba-embedded-signup-connect-business")).toHaveCount(0);
    await expect(page.getByTestId("waba-embedded-signup-connect-api")).toHaveCount(0);
    await expect(page.getByTestId("waba-send")).toBeVisible();

    await saveStableScreenshot(page, "waba-blocked-surface.png");
  });

  test("renders the admin WhatsApp console with technical controls", async ({ page }) => {
    const { email, password } = requireAdminCredentials();
    await loginAdmin(page, email, password);
    await openAdminWhatsapp(page);

    await saveStableScreenshot(page, "waba-admin-console.png");
  });

  test("renders live Meta state from the admin WhatsApp console when a connected reviewer account is configured", async ({
    page,
  }) => {
    const blockers = getLiveReadBlockers();
    test.skip(
      blockers.length > 0,
      `MANUAL_STEP_REQUIRED: ${blockers.join(" | ")}`,
    );

    const { email, password } = requireAdminCredentials();
    await loginAdmin(page, email, password);
    await openAdminWhatsapp(page);

    await expect(page.getByTestId("waba-sync")).toBeEnabled();
    await page.getByTestId("waba-sync").click();
    await expect(page.getByTestId("waba-sync")).toBeEnabled({ timeout: 30_000 });
    await expect(page.getByText(/Sin conexión|Error de conexión/i)).toHaveCount(0);
    await expect(page.getByText(/Canal listo|Canal con alertas/i)).toBeVisible();

    await saveStableScreenshot(page, "waba-live-assets.png");
  });

  test("sends a live reviewer text message and records outbound evidence when explicitly enabled", async ({
    page,
  }) => {
    const blockers = getLiveSendBlockers();
    test.skip(
      blockers.length > 0,
      `MANUAL_STEP_REQUIRED: ${blockers.join(" | ")}`,
    );

    const { email, password } = requireUserCredentials();
    const contactId = process.env.E2E_WABA_CONTACT_ID!.trim();
    const message = `Meta reviewer text proof ${Date.now()}`;

    await loginUser(page, email, password);
    await openWabaWorkspace(page);
    await page.getByTestId(`waba-contact-${contactId}`).click();
    await page.getByRole("button", { name: /^text$/i }).click();
    await page.getByTestId("waba-text-draft").fill(message);
    await page.getByTestId("waba-send").click();

    await expect(page.getByText(/Meta accepted the text send action/i)).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByTestId("waba-messages-panel")).toContainText(message, {
      timeout: 30_000,
    });

    await saveStableScreenshot(page, "waba-live-send.png");
  });

  test("uploads live media and sends it only when explicit media opt-in is configured", async ({
    page,
  }) => {
    const blockers = getLiveMediaBlockers();
    test.skip(
      blockers.length > 0,
      `MANUAL_STEP_REQUIRED: ${blockers.join(" | ")}`,
    );

    const { email, password } = requireUserCredentials();
    const contactId = process.env.E2E_WABA_CONTACT_ID!.trim();
    const mediaPath = process.env.E2E_WABA_MEDIA_FILE!.trim();
    const caption = `Meta reviewer media proof ${Date.now()}`;

    await loginUser(page, email, password);
    await openWabaWorkspace(page);
    await page.getByTestId(`waba-contact-${contactId}`).click();
    await page.getByRole("button", { name: /^media$/i }).click();
    await page.locator('input[type="file"]').setInputFiles(mediaPath);
    await expect(page.getByText(/Media uploaded to Meta:/i)).toBeVisible({
      timeout: 30_000,
    });
    await page.getByPlaceholder(/Caption/i).fill(caption);
    await page.getByTestId("waba-send").click();

    await expect(page.getByText(/Meta accepted the media send action/i)).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByTestId("waba-messages-panel")).toContainText(/image|document/i, {
      timeout: 30_000,
    });

    await saveStableScreenshot(page, "waba-live-media.png");
  });
});
