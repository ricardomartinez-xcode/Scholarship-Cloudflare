import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const rootDir = process.cwd();

function read(relativePath: string) {
  return fs.readFileSync(path.join(rootDir, relativePath), "utf8");
}

describe("smart select dropdowns", () => {
  it("keeps short menus compact while preserving full-width option hit targets", () => {
    const smartSelect = read("apps/web/src/components/SmartSelect.tsx");
    const smartMultiSelect = read("apps/web/src/components/SmartMultiSelect.tsx");
    const globals = read("apps/web/src/app/globals.css");
    const interfaceLight = read("apps/web/src/app/interface-light-blue-white.css");
    const interfaceUnification = read("apps/web/src/app/interface-unification.css");
    const workspaceUi = read("apps/web/src/app/workspace-ui.css");
    const workspaceBrandFix = read("apps/web/src/app/workspace-brand-fix.css");

    expect(smartSelect).toContain("const isCompactMenu =");
    expect(smartMultiSelect).toContain("const isCompactMenu =");
    expect(smartSelect).toContain(
      "clamp(12rem, var(--radix-popover-trigger-width, 12rem), 22rem)",
    );
    expect(smartMultiSelect).toContain(
      "clamp(12rem, var(--radix-popover-trigger-width, 12rem), 22rem)",
    );
    expect(globals).toMatch(/\.ui-select-item\s*\{[\s\S]*?width: 100%;/);
    expect(globals).toMatch(
      /\.ui-select-viewport\[role="listbox"\]\s*\{[\s\S]*?box-shadow: none !important;/,
    );
    expect(interfaceLight).not.toContain('[role="listbox"], .select-content');
    expect(interfaceUnification).not.toContain('[role="listbox"], .select-content');
    expect(workspaceUi).not.toContain('.ui-page-frame [role="listbox"],');
    expect(workspaceBrandFix).not.toContain('.ui-page-frame [role="listbox"],');
  });
});
