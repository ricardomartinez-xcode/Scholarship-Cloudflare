import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { describe, expect, it } from "vitest";

const rootDir = process.cwd();

describe("extension variant verification", () => {
  it("exposes a drift check for generated Chrome extension variants", () => {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(rootDir, "package.json"), "utf8"),
    ) as { scripts?: Record<string, string> };

    expect(packageJson.scripts?.["extension:verify"]).toBe(
      "node scripts/verify-extension-variants.mjs",
    );
    expect(packageJson.scripts?.["extension:sync"]).toBe(
      "node scripts/sync-extension-variants.mjs",
    );
    expect(
      fs.existsSync(path.join(rootDir, "scripts/verify-extension-variants.mjs")),
    ).toBe(true);
    expect(
      fs.existsSync(path.join(rootDir, "scripts/sync-extension-variants.mjs")),
    ).toBe(true);
    expect(
      fs.existsSync(path.join(rootDir, "scripts/extension-variant-config.mjs")),
    ).toBe(true);
  });

  it("keeps the single generated extension variant explicit", async () => {
    const config = (await import(
      pathToFileURL(path.join(rootDir, "scripts/extension-variant-config.mjs")).href
    )) as { manualVariantRoots: string[]; variantRoots: string[] };
    const variantNames = config.variantRoots.map((variantRoot) =>
      path.basename(variantRoot),
    );
    const manualVariantNames = config.manualVariantRoots.map((variantRoot) =>
      path.basename(variantRoot),
    );

    expect(variantNames).toEqual(["preview-first"]);
    expect(manualVariantNames).toEqual([]);
    expect(
      fs.existsSync(path.join(rootDir, "chrome-extension/variants/preview-first")),
    ).toBe(true);
    expect(
      fs.existsSync(path.join(rootDir, "chrome-extension/variants/composer-first")),
    ).toBe(false);
  });

  it("keeps the active variant as the fused ReCalc Sender panel", () => {
    const variantRoot = path.join(rootDir, "chrome-extension/variants/preview-first");
    const manifest = JSON.parse(
      fs.readFileSync(path.join(variantRoot, "manifest.json"), "utf8"),
    ) as {
      action?: { default_popup?: string; default_title?: string };
      host_permissions?: string[];
      name?: string;
      side_panel?: { default_path?: string };
      version?: string;
    };
    const blockedSuffix = "." + "php";

    expect(manifest.name).toBe("ReCalc Sender");
    expect(manifest.version).toBe("6.2.1");
    expect(manifest.action?.default_title).toBe("ReCalc Sender");
    expect(manifest.action?.default_popup).toBeUndefined();
    expect(manifest.side_panel?.default_path).toBe("panel.html");
    expect(manifest.host_permissions).toContain("https://recalc.relead.com.mx/*");
    expect(manifest.host_permissions).toContain("https://web.whatsapp.com/*");
    expect(JSON.stringify(manifest)).not.toContain(blockedSuffix);
  });
});
