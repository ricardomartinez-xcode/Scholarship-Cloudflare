import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const rootDir = process.cwd();

function read(relativePath: string) {
  return fs.readFileSync(path.join(rootDir, relativePath), "utf8");
}

describe("configured CTA popup", () => {
  it("renders popup dialogs through a body portal with the dialog role on the panel", () => {
    const source = read("apps/web/src/components/cta/ConfiguredCtaList.tsx");
    const overlayStart = source.indexOf('className="ui-cta-popup-overlay');
    const panelStart = source.indexOf('role="dialog"');
    const overlayMarkup = source.slice(overlayStart, panelStart);

    expect(source).toContain("createPortal(");
    expect(source).toContain("document.body");
    expect(overlayStart).toBeGreaterThan(-1);
    expect(panelStart).toBeGreaterThan(overlayStart);
    expect(overlayMarkup).not.toContain('role="dialog"');
    expect(overlayMarkup).not.toContain("onClick={onClose}");
    expect(source).toContain("event.target === event.currentTarget");
    expect(source).toContain('role="dialog"');
    expect(source).toContain('aria-modal="true"');
    expect(source).toContain('aria-labelledby={titleId}');
    expect(source).toContain('event.key === "Escape"');
  });

  it("renders popup images in a scrollable preview without cropping them", () => {
    const source = read("apps/web/src/components/cta/ConfiguredCtaList.tsx");

    expect(source).toContain('data-testid="cta-popup-image-preview"');
    expect(source).toContain("overflow-auto");
    expect(source).toContain("object-contain");
    expect(source).not.toContain("max-h-[320px] w-full rounded-2xl border border-[color:var(--ui-border)] object-cover");
  });
});
