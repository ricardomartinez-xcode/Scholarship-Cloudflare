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

  it("keeps preview-first as the only active extension variant", async () => {
    const config = (await import(
      pathToFileURL(path.join(rootDir, "scripts/extension-variant-config.mjs")).href
    )) as { variantRoots: string[] };
    const variantNames = config.variantRoots.map((variantRoot) =>
      path.basename(variantRoot),
    );

    expect(variantNames).toEqual(["preview-first"]);
    expect(
      fs.existsSync(path.join(rootDir, "chrome-extension/variants/preview-first")),
    ).toBe(true);
    expect(
      fs.existsSync(path.join(rootDir, "chrome-extension/variants/composer-first")),
    ).toBe(false);
  });
});
