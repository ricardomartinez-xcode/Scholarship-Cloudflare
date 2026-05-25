import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const rootDir = process.cwd();

function read(relativePath: string) {
  return fs.readFileSync(path.join(rootDir, relativePath), "utf8");
}

describe("admin UI patterns", () => {
  it("uses the shared admin segmented tabs component in dense admin modules", () => {
    const componentPath = "apps/web/src/components/admin/AdminSegmentedTabs.tsx";
    expect(fs.existsSync(path.join(rootDir, componentPath))).toBe(true);

    for (const relativePath of [
      "apps/web/src/components/admin/PricesClient.tsx",
      "apps/web/src/components/admin/BenefitsClient.tsx",
      "apps/web/src/app/(admin)/admin/(protected)/unidep/fees/FeesClient.tsx",
    ]) {
      expect(read(relativePath)).toContain(
        'import AdminSegmentedTabs from "@/components/admin/AdminSegmentedTabs"',
      );
    }
  });
});
