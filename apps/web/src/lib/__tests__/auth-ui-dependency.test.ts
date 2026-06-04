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

  it("keeps OAuth buttons gated by verified Neon providers", () => {
    const source = read("apps/web/src/components/auth/AuthMethodSwitcher.tsx");

    expect(source).toContain('initialMethod = "password"');
    expect(source).toContain("oauthProviders.length");
    expect(source).not.toContain("<GoogleSignInButton");
  });
});
