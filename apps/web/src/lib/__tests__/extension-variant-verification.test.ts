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

  it("registers sidepanel and popup extension variants", async () => {
    const config = (await import(
      pathToFileURL(path.join(rootDir, "scripts/extension-variant-config.mjs")).href
    )) as { allowedVariantRoots: string[]; variantRoots: string[] };
    const allowedVariantNames = config.allowedVariantRoots.map((variantRoot) =>
      path.basename(variantRoot),
    );
    const variantNames = config.variantRoots.map((variantRoot) =>
      path.basename(variantRoot),
    );

    expect(variantNames).toEqual(["preview-first"]);
    expect(allowedVariantNames).toEqual(["preview-first", "Premium-Sender-Backend"]);
    expect(
      fs.existsSync(path.join(rootDir, "chrome-extension/variants/preview-first")),
    ).toBe(true);
    expect(
      fs.existsSync(path.join(rootDir, "chrome-extension/variants/Premium-Sender-Backend")),
    ).toBe(true);
  });

  it("keeps the recovered popup variant pointed at ReCalc legacy aliases", () => {
    const variantRoot = path.join(
      rootDir,
      "chrome-extension/variants/Premium-Sender-Backend",
    );
    const manifest = JSON.parse(
      fs.readFileSync(path.join(variantRoot, "manifest.json"), "utf8"),
    ) as {
      content_security_policy?: { extension_pages?: string; "connect-src"?: string };
      host_permissions?: string[];
      name?: string;
    };
    const popupBundle = fs.readFileSync(path.join(variantRoot, "popup.min.js"), "utf8");
    const backgroundBundle = fs.readFileSync(
      path.join(variantRoot, "background.min.js"),
      "utf8",
    );

    expect(manifest.name).toBe("ReCalc Sender");
    expect(manifest.host_permissions).toContain("https://recalc.relead.com.mx/*");
    expect(JSON.stringify(manifest.content_security_policy)).toContain(
      "https://recalc.relead.com.mx",
    );
    expect(`${popupBundle}\n${backgroundBundle}`).not.toContain("premiumsender.app");
    expect(`${popupBundle}\n${backgroundBundle}`).not.toMatch(/\/(?:mv3\/)?[a-z0-9-]+\.php/);
    expect(popupBundle).toContain("/get-license");
    expect(backgroundBundle).toContain("/uninstall");
  });
});
