const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const selectorsSource = fs.readFileSync(
  path.join(__dirname, "..", "lib", "whatsapp", "wa-selectors.js"),
  "utf8",
);

function createContextWithInputs(inputs, menuOptions = []) {
  class Element {
    constructor() {
      this.disabled = false;
    }

    getBoundingClientRect() {
      return { width: 10, height: 10 };
    }
  }

  class HTMLInputElement extends Element {
    constructor({ accept = "", multiple = false, disabled = false } = {}) {
      super();
      this.type = "file";
      this.accept = accept;
      this.multiple = multiple;
      this.disabled = disabled;
    }
  }

  const inputNodes = inputs.map((input) => new HTMLInputElement(input));
  const optionNodes = menuOptions.map(() => new Element());
  const context = {
    Element,
    HTMLInputElement,
    document: {
      querySelectorAll(selector) {
        if (selector === "input[type='file']") return inputNodes;
        if (selector.includes("[role='menuitem']") || selector.includes("[data-animate-dropdown-item")) {
          return optionNodes;
        }
        return [];
      },
    },
    getComputedStyle() {
      return { display: "block", visibility: "visible" };
    },
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(selectorsSource, context, { filename: "wa-selectors.js" });
  return { context, inputNodes };
}

test("does not use a lone single-image input without a real media menu option", () => {
  const { context, inputNodes } = createContextWithInputs([
    { accept: "image/*", multiple: false },
  ]);

  const selected = context.RecalcWaSelectors.findAttachmentInput("media");

  assert.equal(selected, null);
  assert.equal(inputNodes.length, 1);
});

test("allows a lone single-image input after the media option was explicitly selected", () => {
  const { context, inputNodes } = createContextWithInputs([
    { accept: "image/*", multiple: false },
  ]);

  const selected = context.RecalcWaSelectors.findAttachmentInput("media", null, {
    allowSingleImage: true,
  });

  assert.equal(selected, inputNodes[0]);
});

test("uses WhatsApp single image input after a real media menu option exists", () => {
  const { context, inputNodes } = createContextWithInputs(
    [{ accept: "image/*", multiple: false }],
    [{}, {}],
  );

  const selected = context.RecalcWaSelectors.findAttachmentInput("media");

  assert.equal(selected, inputNodes[0]);
});

test("prefers richer media input when WhatsApp exposes one", () => {
  const { context, inputNodes } = createContextWithInputs([
    { accept: "image/*", multiple: false },
    { accept: "image/*,video/mp4,video/3gpp", multiple: true },
  ]);

  const selected = context.RecalcWaSelectors.findAttachmentInput("media");

  assert.equal(selected, inputNodes[1]);
});

test("does not guess between indistinguishable single-image inputs", () => {
  const { context, inputNodes } = createContextWithInputs([
    { accept: "image/*", multiple: false },
    { accept: "image/*", multiple: false },
  ]);

  const selected = context.RecalcWaSelectors.findAttachmentInput("media");

  assert.equal(selected, null);
  assert.equal(inputNodes.length, 2);
});

test("resolves Premium Sender style attach icons to the clickable button", () => {
  class Element {
    constructor(name) {
      this.name = name;
      this.disabled = false;
    }

    getBoundingClientRect() {
      return { width: 10, height: 10 };
    }

    closest(selector) {
      return selector.includes("button") ? this.parentButton || null : null;
    }
  }

  const button = new Element("button");
  const icon = new Element("icon");
  icon.parentButton = button;

  const context = {
    Element,
    HTMLInputElement: class HTMLInputElement extends Element {},
    document: {
      querySelector() {
        return null;
      },
      querySelectorAll(selector) {
        return selector.includes("data-icon='plus") ? [icon] : [];
      },
    },
    getComputedStyle() {
      return { display: "block", visibility: "visible" };
    },
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(selectorsSource, context, { filename: "wa-selectors.js" });

  assert.equal(context.RecalcWaSelectors.findAttachButton(), button);
});

test("prefers the footer attach button over the sidebar new-chat plus button", () => {
  class Element {
    constructor(name, children = []) {
      this.name = name;
      this.children = children;
      children.forEach((child) => {
        child.parent = this;
      });
    }

    getBoundingClientRect() {
      return { width: 10, height: 10 };
    }

    closest(selector) {
      if (selector.includes("button") && this.name.endsWith("button")) return this;
      return this.parent?.closest?.(selector) || null;
    }

    querySelectorAll(selector) {
      return selector.includes("plus") ? this.children : [];
    }
  }

  const sidebarButton = new Element("sidebar-button");
  const sidebarIcon = new Element("sidebar-icon");
  sidebarIcon.parent = sidebarButton;
  const footerIcon = new Element("footer-icon");
  const footerButton = new Element("footer-button", [footerIcon]);
  const footer = new Element("footer", [footerButton]);

  const context = {
    Element,
    HTMLInputElement: class HTMLInputElement extends Element {},
    document: {
      querySelector(selector) {
        return selector === "footer" ? footer : null;
      },
      querySelectorAll(selector) {
        return selector.includes("plus") ? [sidebarIcon, footerIcon] : [];
      },
    },
    getComputedStyle() {
      return { display: "block", visibility: "visible" };
    },
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(selectorsSource, context, { filename: "wa-selectors.js" });

  assert.equal(context.RecalcWaSelectors.findAttachButton(), footerButton);
});

test("matches attachment options by descendant labels when the option text is icon-only", () => {
  class Element {
    constructor({ label = "", text = "", visible = true, children = [] } = {}) {
      this.label = label;
      this.textContent = text;
      this.innerText = text;
      this.visible = visible;
      this.children = children;
    }

    getAttribute(name) {
      return name === "aria-label" || name === "title" ? this.label : null;
    }

    getBoundingClientRect() {
      return this.visible ? { width: 10, height: 10 } : { width: 0, height: 0 };
    }

    querySelectorAll(selector) {
      return selector.includes("aria-label") || selector.includes("title")
        ? this.children
        : [];
    }
  }

  const mediaLabel = new Element({ label: "Photos & videos" });
  const mediaOption = new Element({ children: [mediaLabel] });
  const context = {
    Element,
    HTMLInputElement: class HTMLInputElement extends Element {},
    document: {
      querySelector() {
        return null;
      },
      querySelectorAll(selector) {
        return selector.includes("[role='menuitem']") ? [mediaOption] : [];
      },
    },
    getComputedStyle() {
      return { display: "block", visibility: "visible" };
    },
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(selectorsSource, context, { filename: "wa-selectors.js" });

  assert.equal(context.RecalcWaSelectors.findAttachmentOption("media"), mediaOption);
});

test("does not match global video call controls as media attachment options", () => {
  class Element {
    constructor({ label = "", visible = true } = {}) {
      this.label = label;
      this.textContent = label;
      this.innerText = label;
      this.visible = visible;
    }

    getAttribute(name) {
      return name === "aria-label" || name === "title" ? this.label : null;
    }

    getBoundingClientRect() {
      return this.visible ? { width: 10, height: 10 } : { width: 0, height: 0 };
    }

    querySelectorAll() {
      return [];
    }
  }

  const videoCallButton = new Element({ label: "Videollamada" });
  const context = {
    Element,
    HTMLInputElement: class HTMLInputElement extends Element {},
    document: {
      querySelector() {
        return null;
      },
      querySelectorAll(selector) {
        if (selector === "[role='menuitem'], [role='button'], button, li, div[aria-label], div[title]") {
          return [videoCallButton];
        }
        return [];
      },
    },
    getComputedStyle() {
      return { display: "block", visibility: "visible" };
    },
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(selectorsSource, context, { filename: "wa-selectors.js" });

  assert.equal(context.RecalcWaSelectors.findAttachmentOption("media"), null);
});

test("resolves the media input scoped to the photos and videos option", () => {
  class Element {
    constructor({ label = "", text = "", visible = true, children = [] } = {}) {
      this.label = label;
      this.textContent = text;
      this.innerText = text;
      this.visible = visible;
      this.children = children;
      this.parent = null;
      children.forEach((child) => {
        child.parent = this;
      });
    }

    getAttribute(name) {
      return name === "aria-label" || name === "title" ? this.label : null;
    }

    getBoundingClientRect() {
      return this.visible ? { width: 10, height: 10 } : { width: 0, height: 0 };
    }

    querySelectorAll(selector) {
      return selector === "input[type='file']"
        ? this.children.filter((child) => child instanceof HTMLInputElement)
        : [];
    }
  }

  class HTMLInputElement extends Element {
    constructor({ accept = "", multiple = false } = {}) {
      super();
      this.accept = accept;
      this.multiple = multiple;
      this.disabled = false;
    }
  }

  const stickerInput = new HTMLInputElement({ accept: "image/*", multiple: false });
  const mediaInput = new HTMLInputElement({ accept: "image/*,video/mp4,video/3gpp", multiple: true });
  const stickerOption = new Element({ label: "Sticker", children: [stickerInput] });
  const mediaOption = new Element({ label: "Photos & videos", children: [mediaInput] });

  const context = {
    Element,
    HTMLInputElement,
    document: {
      querySelector() {
        return null;
      },
      querySelectorAll(selector) {
        if (selector === "input[type='file']") return [stickerInput, mediaInput];
        return selector.includes("[role='menuitem']") ? [stickerOption, mediaOption] : [];
      },
    },
    getComputedStyle() {
      return { display: "block", visibility: "visible" };
    },
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(selectorsSource, context, { filename: "wa-selectors.js" });

  assert.equal(typeof context.RecalcWaSelectors.findAttachmentInputForOption, "function");
  assert.equal(
    context.RecalcWaSelectors.findAttachmentInputForOption(mediaOption, "media"),
    mediaInput,
  );
});

test("uses the media caption textbox as preview anchor when WhatsApp does not expose a dialog", () => {
  class Element {
    constructor({ label = "", visible = true } = {}) {
      this.label = label;
      this.textContent = "";
      this.innerText = "";
      this.visible = visible;
    }

    getAttribute(name) {
      return name === "aria-label" ? this.label : null;
    }

    getBoundingClientRect() {
      return this.visible ? { width: 10, height: 10 } : { width: 0, height: 0 };
    }

    querySelectorAll() {
      return [];
    }
  }

  const captionInput = new Element({ label: "Escribir un mensaje para +52 1 844 533 1540" });
  const context = {
    Element,
    HTMLInputElement: class HTMLInputElement extends Element {},
    document: {
      querySelector() {
        return null;
      },
      querySelectorAll(selector) {
        return selector.includes("Escribir un mensaje para") ? [captionInput] : [];
      },
    },
    getComputedStyle() {
      return { display: "block", visibility: "visible" };
    },
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(selectorsSource, context, { filename: "wa-selectors.js" });

  assert.equal(context.RecalcWaSelectors.findPreviewModal(), captionInput);
  assert.equal(context.RecalcWaSelectors.findCaptionInput(), captionInput);
});

test("uses current WhatsApp media caption container as preview anchor", () => {
  class Element {
    constructor({ attributes = {}, visible = true, inFooter = false } = {}) {
      this.attributes = attributes;
      this.visible = visible;
      this.inFooter = inFooter;
      this.textContent = "";
      this.innerText = "";
    }

    getAttribute(name) {
      return this.attributes[name] ?? null;
    }

    getBoundingClientRect() {
      return this.visible ? { width: 10, height: 10 } : { width: 0, height: 0 };
    }

    closest(selector) {
      return selector === "footer" && this.inFooter ? this : null;
    }

    querySelectorAll() {
      return [];
    }
  }

  const captionInput = new Element({
    attributes: {
      "data-testid": "media-caption-input-container",
      "aria-placeholder": "Escribe un mensaje",
      role: "textbox",
    },
  });
  const context = {
    Element,
    HTMLInputElement: class HTMLInputElement extends Element {},
    document: {
      querySelector() {
        return null;
      },
      querySelectorAll(selector) {
        if (
          selector.includes("media-caption-input-container") ||
          selector.includes("aria-placeholder='Escribe un mensaje'")
        ) {
          return [captionInput];
        }
        return [];
      },
    },
    getComputedStyle() {
      return { display: "block", visibility: "visible" };
    },
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(selectorsSource, context, { filename: "wa-selectors.js" });

  assert.equal(context.RecalcWaSelectors.findPreviewModal(), captionInput);
  assert.equal(context.RecalcWaSelectors.findCaptionInput(), captionInput);
});

test("uses selected-media send button as preview anchor when remove button is absent", () => {
  class Element {
    constructor({ label = "", visible = true } = {}) {
      this.label = label;
      this.textContent = "";
      this.innerText = "";
      this.visible = visible;
    }

    getAttribute(name) {
      return name === "aria-label" ? this.label : null;
    }

    getBoundingClientRect() {
      return this.visible ? { width: 10, height: 10 } : { width: 0, height: 0 };
    }

    closest(selector) {
      return selector === "footer" ? null : this;
    }

    querySelectorAll() {
      return [];
    }
  }

  const selectedSendButton = new Element({ label: "Enviar 1 seleccionado" });
  const context = {
    Element,
    HTMLInputElement: class HTMLInputElement extends Element {},
    document: {
      querySelector() {
        return null;
      },
      querySelectorAll(selector) {
        return selector.includes("seleccionado") ? [selectedSendButton] : [];
      },
    },
    getComputedStyle() {
      return { display: "block", visibility: "visible" };
    },
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(selectorsSource, context, { filename: "wa-selectors.js" });

  assert.equal(context.RecalcWaSelectors.findPreviewModal(), selectedSendButton);
  assert.equal(context.RecalcWaSelectors.findPreviewSendButton(), selectedSendButton);
});

test("merges stale remote selector pack values with local WhatsApp fallbacks", () => {
  const { context } = createContextWithInputs([]);

  const normalized = context.RecalcWaSelectors.normalizeSelectorPack({
    selectors: {
      mediaCaptionInput: "div.old-caption-selector",
      sendButton: "button.old-send-selector",
    },
  });

  assert.match(normalized.selectors.mediaCaptionInput, /old-caption-selector/);
  assert.match(normalized.selectors.mediaCaptionInput, /media-caption-input-container/);
  assert.match(normalized.selectors.sendButton, /old-send-selector/);
  assert.match(normalized.selectors.sendButton, /seleccionado/);
});
