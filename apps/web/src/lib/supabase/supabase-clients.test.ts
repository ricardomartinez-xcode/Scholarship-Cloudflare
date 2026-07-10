import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { createSupabaseAdminClient } from "./admin";

const rootDir = process.cwd();

describe("Supabase client boundaries", () => {
  it("requires a service role only for the admin client", () => {
    expect(() =>
      createSupabaseAdminClient({
        NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
        DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
        DIRECT_URL: "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
      }),
    ).toThrow("SUPABASE_SERVICE_ROLE_KEY is required for Supabase admin operations.");
  });

  it("keeps server-only secrets out of the browser client module", () => {
    const source = fs.readFileSync(
      path.join(rootDir, "apps/web/src/lib/supabase/browser.ts"),
      "utf8",
    );

    expect(source).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(source).not.toContain("DATABASE_URL");
    expect(source).not.toContain("DIRECT_URL");
  });

  it("uses verified auth claims in middleware session refresh", () => {
    const source = fs.readFileSync(
      path.join(rootDir, "apps/web/src/lib/supabase/middleware.ts"),
      "utf8",
    );

    expect(source).toContain("auth.getClaims()");
    expect(source).not.toContain("auth.getSession()");
  });
});
