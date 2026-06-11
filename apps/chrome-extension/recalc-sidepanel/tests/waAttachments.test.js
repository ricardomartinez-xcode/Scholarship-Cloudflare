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

function createMenuPositionHarness(optionLabels = ["Document", "Photos & videos"]) {
  let menuOpened = false;
  let selectedPosition = null;
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

    querySelectorAll() {
      return [];
    }
  }

  class HTMLElement extends Element {
    constructor(name, position = null, label = "") {
      super(name);
      this.position = position;
      this.label = label;
    }

    getAttribute(name) {
      return name === "aria-label" || name === "title" ? this.label : null;
    }

    click() {
      if (this.name === "attach") menuOpened = true;
      if (this.name === "send") sent = true;
      if (this.position !== null) selectedPosition = this.position;
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
  const options = optionLabels.map((label, position) => new HTMLElement(`position-${position}`, position, label));
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
      findAttachmentOptionByPosition(position) {
        return menuOpened ? options[position] : null;
      },
      findAttachmentInput(kind) {
        return selectedPosition !== null && kind === "media" ? input : null;
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
      return { selectedPosition, sent, assignedFiles: input.files };
    },
  };
}

function createScopedMediaInputHarness() {
  let menuOpened = false;
  let selectedOption = null;
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
      if (this.name === "media-option") selectedOption = this;
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

  const stickerInput = new Element("sticker-input");
  stickerInput.accept = "image/*";
  const mediaInput = new Element("media-input");
  mediaInput.accept = "image/*,video/mp4,video/3gpp";
  mediaInput.multiple = true;

  const attachButton = new HTMLElement("attach");
  const mediaOption = new HTMLElement("media-option");
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
      findAttachmentOption(kind) {
        return menuOpened && kind === "media" ? mediaOption : null;
      },
      findAttachmentOptionByPosition() {
        return null;
      },
      findAttachmentInputForOption(option, kind) {
        return option === mediaOption && kind === "media" ? mediaInput : null;
      },
      findAttachmentInput(kind) {
        return selectedOption && kind === "media" ? stickerInput : null;
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
      return {
        sent,
        selectedOption,
        mediaInputFiles: mediaInput.files,
        stickerInputFiles: stickerInput.files,
      };
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

test("prefers WhatsApp photos and videos menu position before the sticker position for media fallback", async () => {
  const harness = createMenuPositionHarness();
  const file = { name: "campaign.jpg", type: "image/jpeg" };

  const result = await harness.context.RecalcWaAttachments.sendMediaAttachments([file], "", {});
  const state = harness.state;

  assert.equal(result.ok, true);
  assert.equal(state.selectedPosition, 1);
  assert.equal(state.sent, true);
  assert.deepEqual(state.assignedFiles, [file]);
});

test("skips sticker-like menu positions when using media fallback", async () => {
  const harness = createMenuPositionHarness(["Document", "Sticker", "Photos & videos"]);
  const file = { name: "campaign.jpg", type: "image/jpeg" };

  const result = await harness.context.RecalcWaAttachments.sendMediaAttachments([file], "", {});
  const state = harness.state;

  assert.equal(result.ok, true);
  assert.equal(state.selectedPosition, 2);
  assert.equal(state.sent, true);
  assert.deepEqual(state.assignedFiles, [file]);
});

test("assigns media files to the input scoped to the media menu option", async () => {
  const harness = createScopedMediaInputHarness();
  const file = { name: "campaign.jpg", type: "image/jpeg" };

  const result = await harness.context.RecalcWaAttachments.sendMediaAttachments([file], "", {});
  const state = harness.state;

  assert.equal(result.ok, true);
  assert.equal(state.selectedOption.name, "media-option");
  assert.equal(state.sent, true);
  assert.deepEqual(state.mediaInputFiles, [file]);
  assert.deepEqual(state.stickerInputFiles, []);
});
