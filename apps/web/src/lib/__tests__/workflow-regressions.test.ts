import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const rootDir = process.cwd();

function read(relativePath: string) {
  return fs.readFileSync(path.join(rootDir, relativePath), "utf8");
}

describe("workflow regressions", () => {
  it("refreshes the academic offer list when server-rendered rows change after saving", () => {
    const source = read("apps/web/src/components/admin/OfferImportClient.tsx");

    expect(source).toContain("setPreviewRows(initialPreviewRows)");
    expect(source).toContain("[initialPreviewRows]");
  });

  it("keeps inbox usable when realtime transport is unavailable and shows reply context", () => {
    const hookSource = read("apps/web/src/hooks/useRealtimeMessages.ts");
    const inboxSource = read("apps/web/src/components/unidep/InboxWorkspace.tsx");

    expect(hookSource).toContain("refreshIntervalMs");
    expect(hookSource).toContain("window.setInterval");
    expect(inboxSource).toContain("refreshIntervalMs: 7000");
    expect(inboxSource).toContain("Respondiendo en");
  });

  it("keeps desktop density and drawer widths compact at 100 percent browser zoom", () => {
    const globals = read("apps/web/src/app/globals.css");
    const a11yPass = read("apps/web/src/app/interface-a11y-responsive-pass.css");
    const appChrome = read("apps/web/src/components/app/AppChrome.tsx");
    const adminChrome = read("apps/web/src/components/admin/AdminChrome.module.css");

    expect(globals).toContain("font-size: 14px");
    expect(globals).toContain("--ui-shell-sidebar-expanded: 264px");
    expect(a11yPass).toContain("body .ui-shell-drawer");
    expect(a11yPass).toContain("max-width: min(82vw, 320px)");
    expect(appChrome).toContain("max-w-[320px]");
    expect(adminChrome).toContain("width: min(82vw, 320px)");
  });

  it("requires the UI-only module selector after payment plan by cycle", () => {
    const source = read("apps/web/src/components/ScholarshipCalculator.tsx");

    expect(source).toContain("MODULE_OPTIONS_BY_CYCLE");
    expect(source).toContain("C2: [\"M1\", \"M2\", \"M3\"]");
    expect(source).toContain("C1: [\"M1\", \"M2\"]");
    expect(source).toContain("C3: [\"M1\", \"M2\"]");
    expect(source).toContain("setSelectedStartModule");
    expect(source).toContain("Módulo de inicio");
    expect(source).toContain("missing: [\"modulo\"]");
  });

  it("makes the plan preview primary and removes redundant download CTAs", () => {
    const source = read("apps/web/src/components/ScholarshipCalculator.tsx");

    expect(source).toContain("ui-plan-preview-layout");
    expect(source).toContain("ui-plan-preview-frame");
    expect(source).toContain("ui-plan-preview-summary");
    expect(source).not.toContain("Descargar plan");
    expect(source).not.toContain("selectedPlanDownloadUrl");
  });

  it("does not render the public marketing header on auth pages", () => {
    const source = read("apps/web/src/components/public/PublicHeader.tsx");

    expect(source).toContain("usePathname");
    expect(source).toContain("pathname.startsWith(\"/auth\")");
    expect(source).toContain("return null");
  });

  it("does not let global button contrast guards recolor floating dock rails", () => {
    const files = [
      "apps/web/src/app/workspace-ui.css",
      "apps/web/src/app/workspace-brand-fix.css",
      "apps/web/src/app/interface-unification.css",
      "apps/web/src/app/interface-light-blue-white.css",
    ];

    for (const file of files) {
      const guardedButtonLines = read(file)
        .split("\n")
        .filter((line) => line.includes('button:not(:disabled):not([data-variant="primary"])'));

      expect(guardedButtonLines.length, file).toBeGreaterThan(0);
      for (const line of guardedButtonLines) {
        expect(line, `${file}: ${line}`).toContain(":not(.ui-floating-calculator__rail)");
        expect(line, `${file}: ${line}`).toContain(":not(.ui-inbox-dock__rail)");
      }
    }
  });
});
