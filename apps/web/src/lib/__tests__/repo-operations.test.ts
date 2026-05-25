import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const rootDir = process.cwd();

describe("repo operations", () => {
  it("exposes a reproducible large-source-file report", () => {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(rootDir, "package.json"), "utf8"),
    ) as { scripts?: Record<string, string> };
    const scriptPath = path.join(rootDir, "scripts/report-large-source-files.mjs");
    const source = fs.readFileSync(scriptPath, "utf8");

    expect(packageJson.scripts?.["repo:large-files"]).toBe(
      "node scripts/report-large-source-files.mjs",
    );
    expect(fs.existsSync(scriptPath)).toBe(true);
    expect(source).toContain('".next"');
    expect(source).toContain('"node_modules"');
    expect(source).toContain("--min-lines=");
  });
});
