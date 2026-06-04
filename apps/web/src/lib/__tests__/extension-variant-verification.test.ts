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

  it("keeps generated and manual extension variants explicit", async () => {
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
    expect(manualVariantNames).toEqual(["Premium-Sender-Backend"]);
    expect(
      fs.existsSync(path.join(rootDir, "chrome-extension/variants/preview-first")),
    ).toBe(true);
    expect(
      fs.existsSync(
        path.join(rootDir, "chrome-extension/variants/Premium-Sender-Backend"),
      ),
    ).toBe(true);
    expect(
      fs.existsSync(path.join(rootDir, "chrome-extension/variants/composer-first")),
    ).toBe(false);
  });

  it("keeps the recovered popup variant pointed at ReCalc aliases", () => {
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
    const bundles = [
      "popup.min.js",
      "background.min.js",
      "page.min.js",
      "content.min.js",
      "lib.min.js",
    ]
      .map((fileName) => fs.readFileSync(path.join(variantRoot, fileName), "utf8"))
      .join("\n");
    const blockedSuffix = "." + "php";

    expect(manifest.name).toBe("ReCalc Sender");
    expect(manifest.host_permissions).toContain("https://recalc.relead.com.mx/*");
    expect(JSON.stringify(manifest.content_security_policy)).toContain(
      "https://recalc.relead.com.mx",
    );
    expect(bundles).not.toContain("premiumsender.app");
    expect(bundles).not.toContain(blockedSuffix);
    expect(bundles).toContain("/get-license");
    expect(bundles).toContain("/uninstall");
  });
});
