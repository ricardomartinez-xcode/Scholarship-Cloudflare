const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const textSource = fs.readFileSync(
  path.join(__dirname, "..", "lib", "whatsapp", "wa-text.js"),
  "utf8",
);

test("clickElement dispatches the full pointer and mouse activation sequence", () => {
  const events = [];

  class Element {
    closest(selector) {
      return selector.includes("button") ? this : null;
    }

    getBoundingClientRect() {
      return { x: 10, y: 20, width: 40, height: 30 };
    }

    scrollIntoView() {}
    focus() {}
    dispatchEvent(event) {
      events.push(event.type);
      return true;
    }
    click() {
      events.push("click-method");
    }
  }

  class HTMLElement extends Element {}

  class MouseEvent {
    constructor(type) {
      this.type = type;
    }
  }

  class PointerEvent extends MouseEvent {}

  const context = {
    Element,
    HTMLElement,
    MouseEvent,
    PointerEvent,
    document: {},
    window: {},
    getSelection() {
      return null;
    },
  };
  context.window = context;
  context.self = context;
  vm.createContext(context);
  vm.runInContext(textSource, context, { filename: "wa-text.js" });

  assert.equal(context.RecalcWaText.clickElement(new HTMLElement()), true);
  assert.deepEqual(events, [
    "pointerover",
    "mouseover",
    "pointerenter",
    "mouseenter",
    "pointerdown",
    "mousedown",
    "pointerup",
    "mouseup",
    "click",
  ]);
});
