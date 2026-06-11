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

test("prefers the second single-image input when the first one is WhatsApp Sticker Maker", () => {
  const { context, inputNodes } = createContextWithInputs([
    { accept: "image/*", multiple: false },
    { accept: "image/*", multiple: false },
  ]);

  const selected = context.RecalcWaSelectors.findAttachmentInput("media");

  assert.equal(selected, inputNodes[1]);
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
