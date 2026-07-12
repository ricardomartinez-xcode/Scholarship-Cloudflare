import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const rootDir = process.cwd();

function read(relativePath: string) {
  return fs.readFileSync(path.join(rootDir, relativePath), "utf8");
}

describe("auth UI dependency boundaries", () => {
  it("keeps password reset forms on the Supabase adapter", () => {
    for (const relativePath of [
      "apps/web/src/components/auth/SupabaseAuthForms.tsx",
      "apps/web/src/components/public/SupabasePasswordReset.tsx",
    ]) {
      expect(read(relativePath)).not.toContain("@neondatabase/auth/react/ui");
    }
  });

  it("keeps active auth adapters on Supabase Auth", () => {
    for (const relativePath of [
      "apps/web/src/lib/auth/server.ts",
      "apps/web/src/lib/auth/client.ts",
      "apps/web/middleware.ts",
    ]) {
      expect(read(relativePath)).toMatch(/supabase|Supabase/);
    }

    for (const relativePath of [
      "apps/web/src/lib/auth/server.ts",
      "apps/web/src/lib/auth/client.ts",
      "apps/web/middleware.ts",
      "apps/web/src/app/api/auth/sign-in/route.ts",
      "apps/web/src/app/api/auth/sign-up/route.ts",
    ]) {
      const source = read(relativePath);
      expect(source).not.toContain("@neondatabase/auth");
      expect(source).not.toContain("@/lib/cloudflare/auth");
      expect(source).not.toContain("@/lib/cloudflare/d1");
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
