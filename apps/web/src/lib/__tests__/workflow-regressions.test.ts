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
    const presenceHookSource = read("apps/web/src/hooks/useRealtimePresence.ts");
    const inboxSource = read("apps/web/src/components/unidep/InboxWorkspace.tsx");
    const dockSource = read("apps/web/src/components/unidep/InboxDock.tsx");
    const serverRealtimeSource = read("apps/web/src/lib/supabase/server-realtime.ts");

    expect(hookSource).toContain("refreshIntervalMs");
    expect(hookSource).toContain("window.setInterval");
    expect(presenceHookSource).toContain("subscribeToPresence");
    expect(inboxSource).toContain("refreshIntervalMs: 7000");
    expect(inboxSource).toContain("privateChannel: false");
    expect(inboxSource).toContain("Respondiendo en");
    expect(dockSource).toContain("dispatchInboxMessageCreated");
    expect(dockSource).toContain("aria-pressed={selected}");
    expect(hookSource).toContain("subscribeToPostgresMessages");
    expect(serverRealtimeSource).toContain("broadcastTrainingMessage");
    expect(serverRealtimeSource).toContain("broadcastInboxMessage");
    expect(serverRealtimeSource).toContain("Postgres Changes");
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

  it("keeps the imported academic module out of the quote UI and required quote fields", () => {
    const source = read("apps/web/src/components/ScholarshipCalculator.tsx");

    expect(read("apps/web/src/lib/academic-modules.ts")).toContain(
      "[\"M1\", \"M2\", \"M3\", \"Longitudinal\", \"Modular\"]",
    );
    expect(source).not.toContain("setSelectedStartModule");
    expect(source).not.toContain("Módulo de inicio");
    expect(source).not.toContain("missing: [\"modulo\"]");
  });

  it("makes the plan preview primary and removes redundant download CTAs", () => {
    const source = read("apps/web/src/components/ScholarshipCalculator.tsx");

    expect(source).toContain("ui-plan-preview-layout");
    expect(source).toContain("ui-plan-preview-frame");
    expect(source).toContain("ui-plan-preview-summary");
    expect(source).not.toContain("Descargar plan");
    expect(source).not.toContain("selectedPlanDownloadUrl");
  });

  it("falls back to the lightweight extension quote runtime when pricing options cannot be fetched", () => {
    const source = read("apps/web/src/components/ScholarshipCalculator.tsx");

    expect(source).toContain("loadPricingOptionsFromExtensionBootstrap");
    expect(source).toContain("/api/ext/bootstrap");
    expect(source).toContain("data.quoteRuntime");
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

  it("keeps CTA editor image previews scrollable instead of cropped thumbnails", () => {
    const source = read("apps/web/src/components/admin/CtasClient.tsx");

    expect(source).toContain('data-testid="cta-admin-image-preview"');
    expect(source).toContain("overflow-auto");
    expect(source).toContain("object-contain");
    expect(source).not.toContain("h-16 w-16 rounded-lg object-cover");
  });
});
