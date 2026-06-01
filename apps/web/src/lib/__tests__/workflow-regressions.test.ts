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
});
