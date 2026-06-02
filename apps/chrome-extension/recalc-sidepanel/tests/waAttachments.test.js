const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const attachmentsSource = fs.readFileSync(
  path.join(__dirname, "..", "lib", "whatsapp", "wa-attachments.js"),
  "utf8",
);

function createMediaHarness() {
  let menuOpened = false;
  let previewVisible = false;
  let sent = false;

  class Element {
    constructor(name) {
      this.name = name;
      this.files = [];
      this.accept = "";
      this.disabled = false;
    }

    dispatchEvent(event) {
      if (event?.type === "change") {
        previewVisible = true;
      }
      return true;
    }
  }

  class HTMLElement extends Element {
    click() {
      if (this.name === "attach") menuOpened = true;
      if (this.name === "send") sent = true;
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

  const input = new Element("media-input");
  input.accept = "image/*";
  const attachButton = new HTMLElement("attach");
  const sendButton = new HTMLElement("send");
  const preview = new Element("preview");

  const context = {
    console,
    Element,
    HTMLElement,
    DataTransfer,
    Event: class Event {
      constructor(type) {
        this.type = type;
      }
    },
    RecalcWaSelectors: {
      findAttachButton() {
        return attachButton;
      },
      findAttachmentOption() {
        return null;
      },
      findAttachmentOptionByPosition() {
        return null;
      },
      findAttachmentInput(kind) {
        return menuOpened && kind === "media" ? input : null;
      },
      findPreviewModal() {
        return previewVisible ? preview : null;
      },
      findPreviewSendButton() {
        return previewVisible ? sendButton : null;
      },
      findCaptionInput() {
        return null;
      },
      findMessageInput() {
        return null;
      },
    },
    RecalcWaText: {
      wait() {
        return Promise.resolve();
      },
      async waitFor(callback) {
        return callback();
      },
      clickElement(target) {
        target.click();
        return true;
      },
      composerText() {
        return "";
      },
      clearComposer() {},
      fillComposer() {
        return false;
      },
    },
  };
  context.window = context;
  context.self = context;
  vm.createContext(context);
  vm.runInContext(attachmentsSource, context, { filename: "wa-attachments.js" });

  return {
    context,
    get state() {
      return { menuOpened, previewVisible, sent, assignedFiles: input.files };
    },
  };
}

test("uses media file input exposed immediately after opening the attachment menu", async () => {
  const harness = createMediaHarness();
  const file = { name: "campaign.jpg", type: "image/jpeg" };

  const result = await harness.context.RecalcWaAttachments.sendMediaAttachments([file], "", {});
  const state = harness.state;

  assert.equal(result.ok, true);
  assert.equal(state.menuOpened, true);
  assert.equal(state.previewVisible, true);
  assert.equal(state.sent, true);
  assert.deepEqual(state.assignedFiles, [file]);
});
