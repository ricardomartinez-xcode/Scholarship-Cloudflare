const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const contentWhatsappSource = fs.readFileSync(
  path.join(__dirname, "..", "content-whatsapp.js"),
  "utf8",
);

function createLegacyAttachMediaHarness() {
  let menuOpen = false;
  let previewVisible = false;

  class Element {
    constructor({ name = "", label = "", children = [] } = {}) {
      this.name = name;
      this.label = label;
      this.children = children;
      this.textContent = label;
      this.innerText = label;
      this.disabled = false;
      children.forEach((child) => {
        child.parent = this;
      });
    }

    getAttribute(name) {
      return name === "aria-label" || name === "title" ? this.label : null;
    }

    matches(selector) {
      if (selector.includes("[role='menuitem']")) return this.role === "menuitem";
      if (selector.includes("button")) return this.name === "attach";
      return false;
    }

    closest(selector) {
      if (selector.includes("[role='menuitem']") && this.role === "menuitem") return this;
      if (selector.includes("button") && this.name === "attach") return this;
      return this.parent?.closest?.(selector) || null;
    }

    querySelectorAll(selector) {
      if (selector === "input[type='file']" || selector.includes("input[type='file']")) {
        return this.children.filter((child) => child instanceof HTMLInputElement);
      }
      return [];
    }

    getBoundingClientRect() {
      return { width: 10, height: 10 };
    }

    focus() {}
    scrollIntoView() {}

    click() {
      if (this.name === "attach") menuOpen = true;
    }

    dispatchEvent(event) {
      if (event?.type === "change") previewVisible = true;
      return true;
    }
  }

  class HTMLElement extends Element {}

  class HTMLInputElement extends HTMLElement {
    constructor({ name, accept = "image/*", multiple = false } = {}) {
      super({ name });
      this.type = "file";
      this.accept = accept;
      this.multiple = multiple;
      this.files = [];
    }

    matches(selector) {
      return selector.includes("input[type='file']");
    }
  }

  class DataTransfer {
    constructor() {
      const files = [];
      this.items = {
        add(file) {
          files.push(file);
        },
      };
      this.files = files;
    }
  }

  class File {
    constructor(parts, name, options = {}) {
      this.parts = parts;
      this.name = name;
      this.type = options.type || "";
    }
  }

  const stickerInput = new HTMLInputElement({ name: "sticker-input" });
  const mediaInput = new HTMLInputElement({ name: "media-input" });
  const attachButton = new HTMLElement({ name: "attach", label: "Attach" });
  const documentOption = new HTMLElement({ name: "document-option", label: "Document" });
  documentOption.role = "menuitem";
  const mediaOption = new HTMLElement({ name: "media-option", label: "Photos & videos", children: [mediaInput] });
  mediaOption.role = "menuitem";
  const preview = new HTMLElement({ name: "preview" });

  const context = {
    console,
    Element,
    HTMLElement,
    HTMLInputElement,
    DataTransfer,
    File,
    Event: class Event {
      constructor(type) {
        this.type = type;
      }
    },
    MouseEvent: class MouseEvent {
      constructor(type) {
        this.type = type;
      }
    },
    InputEvent: class InputEvent {
      constructor(type) {
        this.type = type;
      }
    },
    Blob: class Blob {},
    Headers,
    fetch: async () => ({
      ok: true,
      headers: { get: () => "image/png" },
      blob: async () => ({ type: "image/png" }),
    }),
    chrome: {
      storage: {
        local: {
          async get() {
            return {};
          },
          async remove() {},
        },
      },
      runtime: {
        onMessage: {
          addListener() {},
        },
        async sendMessage() {},
      },
    },
    document: {
      documentElement: new HTMLElement({ name: "html" }),
      body: new HTMLElement({ name: "body" }),
      querySelector(selector) {
        if (selector.includes("div[role='dialog']")) return previewVisible ? preview : null;
        return null;
      },
      querySelectorAll(selector) {
        if (selector.includes("[role='menuitem']") || selector.includes("[data-animate-dropdown-item")) {
          return menuOpen ? [documentOption, mediaOption] : [];
        }
        if (selector.includes("button") || selector.includes("Attach")) return [attachButton];
        if (selector.includes("input[type='file']")) return [stickerInput, mediaInput];
        return [];
      },
      createRange() {
        return { selectNodeContents() {}, collapse() {} };
      },
      execCommand() {
        return true;
      },
    },
    MutationObserver: class MutationObserver {
      observe() {}
      disconnect() {}
    },
    getComputedStyle() {
      return { display: "block", visibility: "visible" };
    },
    setTimeout,
    clearTimeout,
  };
  context.window = context;
  context.self = context;
  vm.createContext(context);
  vm.runInContext(contentWhatsappSource, context, { filename: "content-whatsapp.js" });

  return { context, mediaInput, mediaOption, stickerInput };
}

test("legacy attachMedia assigns files to the scoped media option input", async () => {
  const { context, mediaInput, mediaOption, stickerInput } = createLegacyAttachMediaHarness();

  assert.equal(typeof context.findMediaAttachmentOption, "function");
  assert.equal(typeof context.findFileInput, "function");
  context.findAttachButton(null).click();
  assert.equal(context.findMediaAttachmentOption(), mediaOption);
  assert.equal(
    context.findFileInput(null, { option: mediaOption, scopedToMediaOption: true }),
    mediaInput,
  );

  const attached = await context.attachMedia(null, "https://example.test/campaign.png", "token");

  assert.equal(attached, true);
  assert.equal(mediaInput.files.length, 1);
  assert.equal(mediaInput.files[0].name, "campaign-media.png");
  assert.equal(stickerInput.files.length, 0);
});
