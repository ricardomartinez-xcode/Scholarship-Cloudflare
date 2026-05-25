import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const rootDir = process.cwd();

const adminUiFiles = [
  "apps/web/src/components/admin/CtaLocationPicker.tsx",
  "apps/web/src/components/admin/CtasClient.tsx",
  "apps/web/src/components/admin/SidebarInfoClient.tsx",
  "apps/web/src/app/(admin)/admin/(protected)/unidep/directory/DirectoryClient.tsx",
  "apps/web/src/app/(admin)/admin/(protected)/unidep/programs/ProgramsClient.tsx",
  "apps/web/src/services/repairActionsService.ts",
];

const forbiddenVisibleCopy = [
  /\blegacy\b/i,
  /\(legacy\)/i,
  /Legacy\s*\/\s*oculto/i,
  /Nivel legacy/i,
  /Agrupador legacy/i,
];

describe("admin UI copy", () => {
  it("does not expose legacy migration terminology to operators", () => {
    const matches = adminUiFiles.flatMap((relativePath) => {
      const absolutePath = path.join(rootDir, relativePath);
      const source = fs.readFileSync(absolutePath, "utf8");
      return forbiddenVisibleCopy
        .filter((pattern) => pattern.test(source))
        .map((pattern) => `${relativePath} matches ${pattern}`);
    });

    expect(matches).toEqual([]);
  });

  it("exposes a repair publish action for no-diff draft states", () => {
    const source = fs.readFileSync(
      path.join(rootDir, "apps/web/src/components/admin/ConfigPublishPanel.tsx"),
      "utf8",
    );

    expect(source).toContain("Reparar publicación");
    expect(source).toContain("Republica el snapshot actual");
  });
});
