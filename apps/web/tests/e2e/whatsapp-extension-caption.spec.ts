import fs from "node:fs/promises";
import path from "node:path";

import { chromium, expect, test, type BrowserContext, type Page, type TestInfo } from "@playwright/test";

const EXTENSION_DIR = path.join(process.cwd(), "apps", "chrome-extension", "recalc-sidepanel");
const OUTPUT_ROOT = path.join(process.cwd(), "output", "playwright", "whatsapp-extension");
const DEFAULT_PROFILE_DIR = path.join(process.cwd(), "output", "playwright", "wa-profile");
const LOGIN_TIMEOUT_MS = Number(process.env.PW_WA_LOGIN_TIMEOUT_MS || 5 * 60_000);
const DRY_RUN_CAPTION = process.env.PW_WA_CAPTION?.trim() || "Prueba de caption ReCalc";
const AUTH_ONLY_MODE = process.env.PW_WA_AUTH_ONLY === "1";

const WHATSAPP_HELPER_SCRIPTS = [
  path.join(EXTENSION_DIR, "lib", "whatsapp", "wa-selectors.js"),
  path.join(EXTENSION_DIR, "lib", "whatsapp", "wa-text.js"),
  path.join(EXTENSION_DIR, "lib", "whatsapp", "wa-chat.js"),
];

const DEFAULT_IMAGE_BUFFER = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO2WZ6kAAAAASUVORK5CYII=",
  "base64",
);

type UploadFixture = {
  buffer: Buffer;
  mimeType: string;
  name: string;
};

function normalizePhone(rawValue: string) {
  return String(rawValue || "").replace(/\D+/g, "");
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "artifact";
}

async function ensureDir(dirPath: string) {
  await fs.mkdir(dirPath, { recursive: true });
  return dirPath;
}

async function resolveUploadFixture(): Promise<UploadFixture> {
  const customPath = String(process.env.PW_WA_MEDIA_PATH || "").trim();
  if (!customPath) {
    return {
      buffer: DEFAULT_IMAGE_BUFFER,
      mimeType: "image/png",
      name: "recalc-dry-run.png",
    };
  }

  const absolutePath = path.resolve(customPath);
  const buffer = await fs.readFile(absolutePath);
  const lowerName = path.basename(absolutePath).toLowerCase();
  const mimeType = lowerName.endsWith(".webp")
    ? "image/webp"
    : lowerName.endsWith(".gif")
      ? "image/gif"
      : lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg")
        ? "image/jpeg"
        : "image/png";

  return {
    buffer,
    mimeType,
    name: path.basename(absolutePath),
  };
}

async function launchExtensionContext() {
  await ensureDir(DEFAULT_PROFILE_DIR);
  return chromium.launchPersistentContext(DEFAULT_PROFILE_DIR, {
    headless: false,
    viewport: { width: 1600, height: 960 },
    args: [
      `--disable-extensions-except=${EXTENSION_DIR}`,
      `--load-extension=${EXTENSION_DIR}`,
    ],
  });
}

async function resolveExtensionId(context: BrowserContext) {
  let serviceWorker = context.serviceWorkers()[0] ?? null;
  if (!serviceWorker) {
    serviceWorker = await context.waitForEvent("serviceworker", { timeout: 30_000 });
  }

  const match = serviceWorker.url().match(/^chrome-extension:\/\/([^/]+)\//i);
  if (!match?.[1]) {
    throw new Error("No fue posible resolver el ID de la extensión cargada.");
  }

  return match[1];
}

async function assertExtensionPanelLoads(context: BrowserContext, extensionId: string) {
  const panelPage = await context.newPage();
  try {
    await panelPage.goto(`chrome-extension://${extensionId}/panel.html`, {
      waitUntil: "domcontentloaded",
    });
    await expect(panelPage).toHaveTitle(/ReCalc Panel/i);
    await expect(panelPage.locator("body")).toContainText(/ReCalc|Preparando panel|Inicia sesión/i);
  } finally {
    await panelPage.close().catch(() => undefined);
  }
}

async function addWhatsAppHelpers(page: Page) {
  for (const scriptPath of WHATSAPP_HELPER_SCRIPTS) {
    await page.addInitScript({ path: scriptPath });
  }
}

async function waitForWhatsAppAuth(page: Page, artifactDir: string) {
  const chatReady = page.locator("#pane-side, [data-testid='chat-list'], div[aria-label='Chat list']");
  const qrCode = page.locator("canvas, [data-testid='qrcode']");

  const alreadyReady = await chatReady.first().isVisible({ timeout: 8_000 }).catch(() => false);
  if (alreadyReady) return;

  const qrVisible = await qrCode.first().isVisible({ timeout: 5_000 }).catch(() => false);
  if (!qrVisible) {
    await chatReady.first().waitFor({ state: "visible", timeout: LOGIN_TIMEOUT_MS });
    return;
  }

  const qrPath = path.join(artifactDir, "whatsapp-login-qr.png");
  await page.screenshot({ path: qrPath, fullPage: true });
  console.log(
    [
      "[Playwright][WhatsApp]",
      "El perfil persistente no tiene sesión activa.",
      `Escanea el QR en la ventana abierta. El screenshot quedó en: ${qrPath}`,
      `Esperando hasta ${Math.round(LOGIN_TIMEOUT_MS / 1000)} segundos para reutilizar esta sesión en futuras corridas.`,
    ].join(" "),
  );

  await chatReady.first().waitFor({ state: "visible", timeout: LOGIN_TIMEOUT_MS });
}

async function waitForConversationReady(page: Page) {
  const result = await page.evaluate(async () => {
    const win = window as typeof window & {
      RecalcWaChat?: { ensureChatReady: (pack: unknown) => Promise<unknown> };
    };

    if (!win.RecalcWaChat) {
      return { ok: false, error: "Los helpers de WhatsApp no se cargaron en la página." };
    }

    try {
      await win.RecalcWaChat.ensureChatReady(null);
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "No fue posible preparar el chat de WhatsApp.",
      };
    }
  });

  expect(result.ok, result.error).toBe(true);
}

async function failIfWhatsAppShowsInvalidNumber(page: Page) {
  const invalidMessage = await page.evaluate(() => {
    const text = String(document.body?.innerText || "").toLowerCase();
    const patterns = [
      "no está en whatsapp",
      "no esta en whatsapp",
      "not on whatsapp",
      "phone number shared via url is invalid",
      "número de teléfono compartido",
    ];

    const match = patterns.find((pattern) => text.includes(pattern));
    return match ? String(document.body?.innerText || "").trim() : "";
  });

  if (invalidMessage) {
    throw new Error(`WhatsApp rechazó el número destino. Detalle visible en pantalla: ${invalidMessage}`);
  }
}

async function openMediaChooser(page: Page) {
  const result = await page.evaluate(async () => {
    const win = window as typeof window & {
      RecalcWaSelectors?: {
        findAttachButton: (pack: unknown) => Element | null;
        findAttachmentOptionByPosition: (index: number) => Element | null;
        findAttachmentOption: (kind: string) => Element | null;
        findAttachmentInput: (
          kind: string,
          pack: unknown,
          options?: { allowSingleImage?: boolean },
        ) => HTMLInputElement | null;
        findAttachmentInputForOption?: (option: Element, kind: string, pack: unknown) => HTMLInputElement | null;
        matchAnyText?: (node: Element, needles: string[]) => boolean;
      };
      RecalcWaText?: {
        clickElement: (target: Element | null) => boolean;
      };
    };

    const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));
    const stickerNeedles = [
      "sticker",
      "stickers",
      "sticker maker",
      "pegatina",
      "pegatinas",
      "calcomanía",
      "calcomanías",
      "calcomania",
      "calcomanias",
    ];
    const accessibleText = (node: Element | null) => {
      if (!node) return "";
      const parts = [
        node.getAttribute("aria-label"),
        node.getAttribute("title"),
        node.getAttribute("data-icon"),
        node.textContent,
        (node as HTMLElement).innerText,
      ];
      node.querySelectorAll?.("[aria-label], [title], [data-icon], title").forEach((child) => {
        parts.push(
          child.getAttribute("aria-label"),
          child.getAttribute("title"),
          child.getAttribute("data-icon"),
          child.textContent,
          (child as HTMLElement).innerText,
        );
      });
      return parts
        .map((value) => String(value || "").trim().toLowerCase())
        .filter(Boolean)
        .join(" ");
    };
    const isStickerLike = (node: Element | null) => {
      if (!node) return false;
      if (typeof win.RecalcWaSelectors?.matchAnyText === "function") {
        return win.RecalcWaSelectors.matchAnyText(node, stickerNeedles);
      }
      const haystack = accessibleText(node);
      return stickerNeedles.some((needle) => haystack.includes(needle));
    };
    const safeMediaOptionByPosition = () => {
      for (const position of [1, 2, 3, 0]) {
        const option = win.RecalcWaSelectors?.findAttachmentOptionByPosition(position) || null;
        if (option && !isStickerLike(option)) return option;
      }
      return null;
    };

    if (!win.RecalcWaSelectors || !win.RecalcWaText) {
      return { ok: false, error: "Los helpers de selector o click no están disponibles." };
    }

    const attachButton = win.RecalcWaSelectors.findAttachButton(null);
    if (!attachButton) {
      return { ok: false, error: "No se encontró el botón de adjuntar en WhatsApp Web." };
    }

    if (!win.RecalcWaText.clickElement(attachButton)) {
      return { ok: false, error: "No se pudo abrir el menú de adjuntos." };
    }

    let option: Element | null = null;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      option =
        win.RecalcWaSelectors.findAttachmentOption("media") ||
        safeMediaOptionByPosition();
      if (option) break;
      await wait(150);
    }

    if (!option) {
      return { ok: false, error: "No se encontró la opción de imagen/video del menú de adjuntos." };
    }

    const scopedInput = typeof win.RecalcWaSelectors.findAttachmentInputForOption === "function"
      ? win.RecalcWaSelectors.findAttachmentInputForOption(option, "media", null)
      : null;

    if (!win.RecalcWaText.clickElement(option)) {
      return { ok: false, error: "No se pudo seleccionar la opción de imagen/video." };
    }

    let target = scopedInput;
    for (let attempt = 0; attempt < 20 && !target; attempt += 1) {
      target =
        (typeof win.RecalcWaSelectors.findAttachmentInputForOption === "function"
          ? win.RecalcWaSelectors.findAttachmentInputForOption(option, "media", null)
          : null) ||
        win.RecalcWaSelectors.findAttachmentInput("media", null, { allowSingleImage: true });
      if (target) break;
      await wait(150);
    }

    const inputs = Array.from(document.querySelectorAll<HTMLInputElement>("input[type='file']"));
    const inputIndex = target ? inputs.indexOf(target) : -1;
    return {
      ok: inputIndex >= 0,
      inputIndex,
      optionText: accessibleText(option).slice(0, 200),
      inputAccept: target?.accept || "",
      inputMultiple: Boolean(target?.multiple),
      error: inputIndex >= 0 ? null : "No se encontró un input de media seguro después de seleccionar Fotos y videos.",
    };
  });

  expect(result.ok, `${result.error || ""} option=${result.optionText || ""}`).toBe(true);
  expect(result.inputIndex).toBeGreaterThanOrEqual(0);
  return result.inputIndex ?? -1;
}

async function fillPreviewCaption(page: Page, caption: string) {
  const captionSelector = [
    "div[role='textbox'][contenteditable='true'][aria-label*='Escribir un mensaje para']",
    "div[role='textbox'][contenteditable='true'][aria-label*='Write a message for']",
    "div[role='textbox'][contenteditable='true'][data-tab='10']",
    "div[role='textbox'][contenteditable='true'][data-tab='6']",
  ].join(", ");

  const input = page.locator(captionSelector).first();
  await expect(input).toBeVisible({ timeout: 5_000 });
  await input.click();
  await page.keyboard.press("Control+A");
  await page.keyboard.press("Backspace");
  await page.keyboard.type(caption, { delay: 25 });

  const applied = await page.evaluate(async () => {
    const win = window as typeof window & {
      RecalcWaSelectors?: {
        findCaptionInput: (pack: unknown) => Element | null;
      };
      RecalcWaText?: {
        composerText: (node: Element | null) => string;
        waitFor?: <T>(callback: () => T | null, timeoutMs: number, intervalMs: number) => Promise<T | null>;
      };
    };

    if (!win.RecalcWaSelectors || !win.RecalcWaText) {
      return { ok: false, error: "No se encontraron los helpers para escribir el caption." };
    }

    const waitFor =
      typeof win.RecalcWaText.waitFor === "function"
        ? win.RecalcWaText.waitFor.bind(win.RecalcWaText)
        : async (callback: () => Element | null) => callback();

    const captionInput = await waitFor(
      () => win.RecalcWaSelectors?.findCaptionInput(null) || null,
      5000,
      200,
    );
    if (!captionInput) {
      return { ok: false, error: "No apareció el campo de caption dentro del preview." };
    }

    return {
      ok: Boolean(win.RecalcWaText.composerText(captionInput)),
      value: win.RecalcWaText.composerText(captionInput),
    };
  });

  expect(applied.ok, `${applied.error}${applied.value ? ` Valor detectado: ${applied.value}` : ""}`).toBe(true);
  expect(applied.value).toBe(caption);
}

async function assertPreviewReady(page: Page) {
  await expect
    .poll(async () => {
      return page.evaluate(() => {
        const win = window as typeof window & {
          RecalcWaSelectors?: {
            findPreviewModal: (pack: unknown) => Element | null;
            findPreviewSendButton?: (pack: unknown) => Element | null;
            findSendButton: (pack: unknown) => Element | null;
          };
        };

        if (!win.RecalcWaSelectors) return { preview: false, send: false };
        return {
          preview: Boolean(win.RecalcWaSelectors.findPreviewModal(null)),
          send: Boolean(
            win.RecalcWaSelectors.findPreviewSendButton?.(null) ||
            win.RecalcWaSelectors.findSendButton(null),
          ),
        };
      });
    }, { timeout: 15_000 })
    .toEqual({ preview: true, send: true });
}

test.describe.configure({ mode: "serial" });

test("dry-run: carga la extensión, reutiliza perfil de WhatsApp y deja lista una imagen con caption sin enviarla", async ({
}, testInfo: TestInfo) => {
  test.skip(process.env.CI === "true", "Este flujo requiere navegador real y sesión manual/local.");

  const rawRecipientPhone = String(process.env.PW_WA_RECIPIENT_PHONE || "").trim();
  test.skip(
    !AUTH_ONLY_MODE && !rawRecipientPhone,
    "Define PW_WA_RECIPIENT_PHONE con el número destino para abrir el chat o usa PW_WA_AUTH_ONLY=1.",
  );

  test.setTimeout(10 * 60_000);

  const recipientPhone = normalizePhone(rawRecipientPhone);
  const uploadFixture = await resolveUploadFixture();
  const artifactDir = await ensureDir(path.join(OUTPUT_ROOT, slugify(testInfo.title)));
  const sendUrl = `https://web.whatsapp.com/send?phone=${encodeURIComponent(recipientPhone)}&app_absent=0`;

  const context = await launchExtensionContext();
  try {
    const extensionId = await resolveExtensionId(context);
    await assertExtensionPanelLoads(context, extensionId);

    const page = await context.newPage();
    await addWhatsAppHelpers(page);
    await page.goto("https://web.whatsapp.com/", { waitUntil: "domcontentloaded" });
    await waitForWhatsAppAuth(page, artifactDir);

    if (AUTH_ONLY_MODE) {
      const authPath = path.join(artifactDir, "whatsapp-authenticated-home.png");
      await page.screenshot({ path: authPath, fullPage: true });
      console.log(
        [
          "[Playwright][WhatsApp]",
          "Autenticación inicial completada.",
          "La sesión quedó guardada en el perfil persistente para futuras corridas.",
          `Screenshot: ${authPath}`,
        ].join(" "),
      );
      return;
    }

    await page.goto(sendUrl, { waitUntil: "domcontentloaded" });
    await failIfWhatsAppShowsInvalidNumber(page);
    await waitForConversationReady(page);

    const inputIndex = await openMediaChooser(page);
    await page.locator("input[type='file']").nth(inputIndex).setInputFiles(uploadFixture);

    await assertPreviewReady(page);
    await fillPreviewCaption(page, DRY_RUN_CAPTION);

    const previewPath = path.join(artifactDir, "whatsapp-preview-before-send.png");
    await page.screenshot({ path: previewPath, fullPage: true });

    console.log(
      [
        "[Playwright][WhatsApp]",
        "Dry-run completado.",
        "La imagen quedó cargada en el preview con caption escrito.",
        "No se hizo clic en Enviar por seguridad.",
        `Screenshot: ${previewPath}`,
      ].join(" "),
    );
  } finally {
    await context.close();
  }
});
