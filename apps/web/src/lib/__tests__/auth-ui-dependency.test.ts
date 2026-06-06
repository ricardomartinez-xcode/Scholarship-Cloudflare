import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const rootDir = process.cwd();

function read(relativePath: string) {
  return fs.readFileSync(path.join(rootDir, relativePath), "utf8");
}

describe("auth UI dependency boundaries", () => {
  it("keeps password reset forms off the Neon auth-ui beta bundle", () => {
    for (const relativePath of [
      "apps/web/src/components/auth/NeonAuthForms.tsx",
      "apps/web/src/components/public/NeonPasswordReset.tsx",
    ]) {
      expect(read(relativePath)).not.toContain("@neondatabase/auth/react/ui");
    }
  });

  it("keeps public auth pages off mutating server session reads", () => {
    for (const relativePath of [
      "apps/web/src/app/(public)/auth/sign-in/page.tsx",
      "apps/web/src/app/(public)/auth/sign-up/page.tsx",
    ]) {
      expect(read(relativePath)).not.toContain("auth.getSession");
    }
  });
});
