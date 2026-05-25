import fs from "node:fs";
import path from "node:path";

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
    expect(
      fs.existsSync(path.join(rootDir, "scripts/verify-extension-variants.mjs")),
    ).toBe(true);
  });
});
