import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const WHATSAPP_SCRIPT_DIR = path.join(
  process.cwd(),
  "chrome-extension",
  "variants",
  "preview-first",
  "lib",
  "whatsapp",
);

const WHATSAPP_SCRIPT_PATHS = [
  path.join(WHATSAPP_SCRIPT_DIR, "wa-selectors.js"),
  path.join(WHATSAPP_SCRIPT_DIR, "wa-text.js"),
  path.join(WHATSAPP_SCRIPT_DIR, "wa-attachments.js"),
];

const TINY_PNG_BUFFER = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO2WZ6kAAAAASUVORK5CYII=",
  "base64",
);

async function loadWhatsAppModules(page: Page) {
  for (const scriptPath of WHATSAPP_SCRIPT_PATHS) {
    await page.addScriptTag({ path: scriptPath });
  }
}

async function setFixture(page: Page, html: string) {
  await page.goto("about:blank");
  await page.setContent(html, { waitUntil: "domcontentloaded" });
  await loadWhatsAppModules(page);
}

function sendButtonFixture() {
  return `
    <style>
      body { font-family: sans-serif; }
      button, [role="textbox"] { min-width: 48px; min-height: 24px; }
    </style>
    <footer>
      <div id="main-composer" role="textbox" contenteditable="true"></div>
      <button id="send-button" aria-label="Enviar">
        <span id="send-icon" data-icon="send"></span>
      </button>
    </footer>
    <script>
      window.fixtureState = { buttonClicks: 0, iconClicks: 0 };
      document.getElementById("send-button").addEventListener("click", () => {
        window.fixtureState.buttonClicks += 1;
      });
      document.getElementById("send-icon").addEventListener("click", () => {
        window.fixtureState.iconClicks += 1;
      });
    </script>
  `;
}

function attachmentFixture() {
  return `
    <style>
      body { font-family: sans-serif; }
      button, [role="menuitem"], [role="textbox"], input[type="file"] {
        min-width: 48px;
        min-height: 24px;
      }
      #attachment-menu,
      #preview-modal {
        display: none;
      }
    </style>
    <footer>
      <div id="main-composer" role="textbox" contenteditable="true"></div>
    </footer>

    <button id="attach-button" aria-label="Adjuntar">
      <span id="attach-icon" data-icon="plus"></span>
    </button>

    <div id="attachment-menu" role="menu">
      <div id="media-option" role="menuitem">Photos &amp; videos</div>
      <div id="document-option" role="menuitem">Document</div>
    </div>

    <input id="document-input" type="file" accept="application/pdf,.pdf" />
    <input id="media-input" type="file" accept="image/*,video/*" />
    <input id="generic-input" type="file" />

    <div id="preview-modal" role="dialog">
      <div id="remove-attachment" role="button" aria-label="Quitar archivo adjunto"></div>
      <div id="modal-caption" role="textbox" contenteditable="true" data-tab="10"></div>
      <button id="modal-send-button" aria-label="Enviar">
        <span id="modal-send-icon" data-icon="send"></span>
      </button>
    </div>

    <script>
      window.fixtureState = {
        attachButtonClicks: 0,
        attachIconClicks: 0,
        modalSendClicks: 0,
        modalSendIconClicks: 0,
        selectedOption: null,
        nativePickerRequests: 0,
        lastChangedInput: null
      };

      const attachmentMenu = document.getElementById("attachment-menu");
      const previewModal = document.getElementById("preview-modal");
      const attachButton = document.getElementById("attach-button");
      const attachIcon = document.getElementById("attach-icon");
      const mediaOption = document.getElementById("media-option");
      const documentOption = document.getElementById("document-option");
      const modalSendButton = document.getElementById("modal-send-button");
      const modalSendIcon = document.getElementById("modal-send-icon");
      const inputs = Array.from(document.querySelectorAll('input[type="file"]'));

      attachButton.addEventListener("click", () => {
        window.fixtureState.attachButtonClicks += 1;
        attachmentMenu.style.display = "block";
      });

      attachIcon.addEventListener("click", () => {
        window.fixtureState.attachIconClicks += 1;
      });

      mediaOption.addEventListener("click", () => {
        window.fixtureState.selectedOption = "media-option";
        window.fixtureState.nativePickerRequests += 1;
      });

      documentOption.addEventListener("click", () => {
        window.fixtureState.selectedOption = "document-option";
      });

      for (const input of inputs) {
        input.addEventListener("change", () => {
          window.fixtureState.lastChangedInput = input.id;
          previewModal.style.display = "block";
        });
      }

      modalSendButton.addEventListener("click", () => {
        window.fixtureState.modalSendClicks += 1;
        previewModal.style.display = "none";
      });

      modalSendIcon.addEventListener("click", () => {
        window.fixtureState.modalSendIconClicks += 1;
      });
    </script>
  `;
}

function lazyAttachmentFixture() {
  return `
    <style>
      button, [role="menuitem"], [role="textbox"] { min-width: 48px; min-height: 24px; }
      #attachment-menu, #preview-modal { display: none; }
    </style>
    <footer><div id="main-composer" role="textbox" contenteditable="true"></div></footer>
    <button id="attach-button" aria-label="Adjuntar"><span data-icon="plus"></span></button>
    <div id="attachment-menu" role="menu">
      <div id="media-option" role="menuitem">Fotos y videos</div>
    </div>
    <div id="preview-modal" role="dialog">
      <div role="button" aria-label="Quitar archivo adjunto"></div>
      <div id="modal-caption" role="textbox" contenteditable="true" data-tab="10"></div>
      <button id="modal-send-button" aria-label="Enviar"><span data-icon="send"></span></button>
    </div>
    <script>
      window.fixtureState = {
        optionActivations: 0,
        lastChangedInput: null,
        modalSendClicks: 0
      };
      const menu = document.getElementById("attachment-menu");
      const preview = document.getElementById("preview-modal");
      document.getElementById("attach-button").addEventListener("click", () => {
        menu.style.display = "block";
      });
      document.getElementById("media-option").addEventListener("click", () => {
        window.fixtureState.optionActivations += 1;
        let input = document.getElementById("lazy-media-input");
        if (!input) {
          input = document.createElement("input");
          input.id = "lazy-media-input";
          input.type = "file";
          input.accept = "image/*";
          input.addEventListener("change", () => {
            window.fixtureState.lastChangedInput = input.id;
            preview.style.display = "block";
          });
          document.body.appendChild(input);
        }
        input.click();
      });
      document.getElementById("modal-send-button").addEventListener("click", () => {
        window.fixtureState.modalSendClicks += 1;
        preview.style.display = "none";
      });
    </script>
  `;
}

function stickerOnlyAttachmentFixture() {
  return `
    <style>
      body { font-family: sans-serif; }
      button, [role="menuitem"], input[type="file"] {
        min-width: 48px;
        min-height: 24px;
      }
      #attachment-menu {
        display: block;
      }
    </style>

    <button id="attach-button" aria-label="Adjuntar">
      <span id="attach-icon" data-icon="plus"></span>
    </button>

    <div id="attachment-menu" role="menu">
      <div id="sticker-option" role="menuitem">Sticker</div>
    </div>

    <input id="sticker-input" type="file" accept="image/*" />
  `;
}

test.describe("WhatsApp media automation", () => {
  test("clickSend usa el botón real y no el span interno", async ({ page }) => {
    await setFixture(page, sendButtonFixture());

    const result = await page.evaluate(() => {
      const win = window as typeof window & {
        RecalcWaText: { clickSend: (pack: unknown) => boolean };
      };
      return win.RecalcWaText.clickSend(null);
    });

    expect(result).toBe(true);

    const state = await page.evaluate(() => (window as typeof window & {
      fixtureState: { buttonClicks: number; iconClicks: number };
    }).fixtureState);

    expect(state.buttonClicks).toBe(1);
    expect(state.iconClicks).toBe(0);
  });

  test("encuentra la opción media y el input correcto por scoring", async ({ page }) => {
    await setFixture(page, attachmentFixture());
    await page.click("#attach-button");

    const selection = await page.evaluate(() => {
      const win = window as typeof window & {
        RecalcWaSelectors: {
          findAttachmentOption: (kind: string) => HTMLElement | null;
          findAttachmentInput: (kind: string, pack: unknown) => HTMLInputElement | null;
        };
      };

      return {
        optionId: win.RecalcWaSelectors.findAttachmentOption("media")?.id ?? null,
        mediaInputId: win.RecalcWaSelectors.findAttachmentInput("media", null)?.id ?? null,
        documentInputId: win.RecalcWaSelectors.findAttachmentInput("document", null)?.id ?? null,
      };
    });

    expect(selection.optionId).toBe("media-option");
    expect(selection.mediaInputId).toBe("media-input");
    expect(selection.documentInputId).toBe("document-input");
  });

  test("permite file upload con Playwright sobre el input media elegido", async ({ page }) => {
    await setFixture(page, attachmentFixture());

    const inputId = await page.evaluate(() => {
      const win = window as typeof window & {
        RecalcWaSelectors: {
          findAttachmentInput: (kind: string, pack: unknown) => HTMLInputElement | null;
        };
      };
      return win.RecalcWaSelectors.findAttachmentInput("media", null)?.id ?? null;
    });

    expect(inputId).toBe("media-input");

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "recalc-wa-test-"));
    const tempImagePath = path.join(tempDir, "tiny.png");
    await fs.writeFile(tempImagePath, TINY_PNG_BUFFER);

    try {
      await page.locator(`#${inputId}`).setInputFiles(tempImagePath);

      const uploaded = await page.evaluate(() => {
        const input = document.getElementById("media-input") as HTMLInputElement | null;
        return {
          fileName: input?.files?.[0]?.name ?? null,
          total: input?.files?.length ?? 0,
        };
      });

      expect(uploaded.fileName).toBe("tiny.png");
      expect(uploaded.total).toBe(1);
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  test("captura el input creado al activar Fotos y videos sin abrir el selector nativo", async ({ page }) => {
    await setFixture(page, lazyAttachmentFixture());
    let fileChooserOpened = false;
    page.on("filechooser", () => { fileChooserOpened = true; });

    const result = await page.evaluate(async () => {
      const win = window as typeof window & {
        RecalcWaAttachments: {
          sendMediaAttachments: (files: File[], caption: string, pack: unknown) => Promise<{ ok: boolean; captionApplied: boolean }>;
        };
        fixtureState: { optionActivations: number; lastChangedInput: string | null; modalSendClicks: number };
      };
      const file = new File([new Uint8Array([137, 80, 78, 71])], "lazy.png", { type: "image/png" });
      const sendResult = await win.RecalcWaAttachments.sendMediaAttachments([file], "", null);
      return { sendResult, state: win.fixtureState };
    });

    expect(fileChooserOpened).toBe(false);
    expect(result.sendResult.ok).toBe(true);
    expect(result.state.optionActivations).toBe(1);
    expect(result.state.lastChangedInput).toBe("lazy-media-input");
    expect(result.state.modalSendClicks).toBe(1);
  });

  test("no usa el input image/* simple que dispara Sticker Maker", async ({ page }) => {
    await setFixture(page, stickerOnlyAttachmentFixture());

    const inputId = await page.evaluate(() => {
      const win = window as typeof window & {
        RecalcWaSelectors: {
          findAttachmentInput: (kind: string, pack: unknown) => HTMLInputElement | null;
        };
      };
      return win.RecalcWaSelectors.findAttachmentInput("media", null)?.id ?? null;
    });

    expect(inputId).toBeNull();
  });

  test("usa el botón contenedor real para adjuntar y escribe el caption dentro del modal", async ({ page }) => {
    await setFixture(page, attachmentFixture());

    const result = await page.evaluate(async () => {
      const win = window as typeof window & {
        RecalcWaAttachments: {
          sendMediaAttachments: (
            files: File[],
            caption: string,
            pack: unknown,
          ) => Promise<{ ok: boolean; captionApplied: boolean }>;
        };
        fixtureState: {
          attachButtonClicks: number;
          attachIconClicks: number;
          modalSendClicks: number;
          modalSendIconClicks: number;
          selectedOption: string | null;
          nativePickerRequests: number;
          lastChangedInput: string | null;
        };
      };

      const file = new File([new Uint8Array([137, 80, 78, 71])], "photo.png", {
        type: "image/png",
      });

      const sendResult = await win.RecalcWaAttachments.sendMediaAttachments(
        [file],
        "Caption dentro del modal",
        null,
      );

      const modalCaption = document.getElementById("modal-caption");
      const mainComposer = document.getElementById("main-composer");

      return {
        sendResult,
        state: win.fixtureState,
        modalCaption: modalCaption?.textContent?.trim() ?? "",
        mainComposer: mainComposer?.textContent?.trim() ?? "",
        previewVisible: window.getComputedStyle(document.getElementById("preview-modal")!).display !== "none",
      };
    });

    expect(result.sendResult.ok).toBe(true);
    expect(result.sendResult.captionApplied).toBe(true);
    expect(result.state.attachButtonClicks).toBe(1);
    expect(result.state.attachIconClicks).toBe(0);
    expect(result.state.selectedOption).toBeNull();
    expect(result.state.nativePickerRequests).toBe(0);
    expect(result.state.lastChangedInput).toBe("media-input");
    expect(result.state.modalSendClicks).toBe(1);
    expect(result.state.modalSendIconClicks).toBe(0);
    expect(result.previewVisible).toBe(false);
    expect(result.modalCaption).toBe("Caption dentro del modal");
    expect(result.mainComposer).toBe("");
  });
});


test.describe("ReCalc Sender 10.7 media matrix", () => {
  for (const scenario of [
    { label: "imagen con texto", mime: "image/png", name: "photo.png", caption: "Texto de imagen" },
    { label: "imagen sin texto", mime: "image/png", name: "photo.png", caption: "" },
    { label: "video con texto", mime: "video/mp4", name: "video.mp4", caption: "Texto de video" },
    { label: "video sin texto", mime: "video/mp4", name: "video.mp4", caption: "" },
  ]) {
    test(scenario.label, async ({ page }) => {
      await setFixture(page, attachmentFixture());
      const result = await page.evaluate(async (input) => {
        const win = window as typeof window & {
          RecalcWaAttachments: {
            sendMediaAttachments: (
              files: File[],
              caption: string,
              pack: unknown,
            ) => Promise<{ ok: boolean; captionApplied: boolean }>;
          };
          fixtureState: {
            selectedOption: string | null;
            nativePickerRequests: number;
            lastChangedInput: string | null;
            modalSendClicks: number;
          };
        };
        const file = new File([new Uint8Array([1, 2, 3, 4])], input.name, { type: input.mime });
        const sendResult = await win.RecalcWaAttachments.sendMediaAttachments([file], input.caption, null);
        return {
          sendResult,
          state: win.fixtureState,
          modalCaption: document.getElementById("modal-caption")?.textContent?.trim() ?? "",
        };
      }, scenario);

      expect(result.sendResult.ok).toBe(true);
      expect(result.state.selectedOption).toBeNull();
      expect(result.state.nativePickerRequests).toBe(0);
      expect(result.state.lastChangedInput).toBe("media-input");
      expect(result.state.modalSendClicks).toBe(1);
      expect(result.modalCaption).toBe(scenario.caption);
      expect(result.sendResult.captionApplied).toBe(Boolean(scenario.caption));
    });
  }
});
