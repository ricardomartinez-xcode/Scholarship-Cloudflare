import { describe, expect, it } from "vitest";

import {
  DEFAULT_EXTENSION_SELECTOR_PACK,
  normalizeExtensionSelectorPack,
} from "@/lib/extension-selector-pack";

describe("DEFAULT_EXTENSION_SELECTOR_PACK", () => {
  it("publishes current WhatsApp media caption and selected-send selectors", () => {
    expect(DEFAULT_EXTENSION_SELECTOR_PACK.version).toBe(
      "waweb-2026.06.18-media-caption-03",
    );
    expect(DEFAULT_EXTENSION_SELECTOR_PACK.selectors.mediaCaptionInput).toContain(
      "media-caption-input-container",
    );
    expect(DEFAULT_EXTENSION_SELECTOR_PACK.selectors.mediaCaptionInput).toContain(
      "aria-placeholder='Escribe un mensaje'",
    );
    expect(DEFAULT_EXTENSION_SELECTOR_PACK.selectors.sendButton).toContain(
      "seleccionado",
    );
    expect(DEFAULT_EXTENSION_SELECTOR_PACK.selectors.sendButton).toContain(
      "selected",
    );
  });

  it("merges stale configured selectors with current defaults", () => {
    const pack = normalizeExtensionSelectorPack({
      selectors: {
        mediaCaptionInput: "div.old-caption-selector",
        sendButton: "button.old-send-selector",
      },
    });

    expect(pack.selectors.mediaCaptionInput).toContain("div.old-caption-selector");
    expect(pack.selectors.mediaCaptionInput).toContain(
      "media-caption-input-container",
    );
    expect(pack.selectors.sendButton).toContain("button.old-send-selector");
    expect(pack.selectors.sendButton).toContain("seleccionado");
  });
});
