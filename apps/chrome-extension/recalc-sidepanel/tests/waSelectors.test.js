const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const selectorsSource = fs.readFileSync(
  path.join(__dirname, "..", "lib", "whatsapp", "wa-selectors.js"),
  "utf8",
);

function createContextWithInputs(inputs) {
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
  const context = {
    Element,
    HTMLInputElement,
    document: {
      querySelectorAll(selector) {
        return selector === "input[type='file']" ? inputNodes : [];
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

test("uses WhatsApp single image input as media fallback", () => {
  const { context, inputNodes } = createContextWithInputs([
    { accept: "image/*", multiple: false },
  ]);

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
