import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { parseClientEnv, parseServerEnv } from "./shared";

describe("environment validation", () => {
  it("uses static NEXT_PUBLIC references that Next.js can inline in client bundles", () => {
    const source = fs.readFileSync(path.join(__dirname, "client.ts"), "utf8");

    expect(source).toContain("process.env.NEXT_PUBLIC_SUPABASE_URL");
    expect(source).toContain("process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY");
    expect(source).toContain("process.env.NEXT_PUBLIC_APP_URL");
    expect(source).not.toContain("parseClientEnv(process.env)");
  });

  it("requires public Supabase variables for browser clients", () => {
    expect(() => parseClientEnv({})).toThrow(
      "Missing required public environment variables: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  });

  it("returns only public variables from client env", () => {
    const env = parseClientEnv({
      NEXT_PUBLIC_APP_URL: "https://preview.example.com",
      NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
      SUPABASE_SERVICE_ROLE_KEY: "server-secret",
      DATABASE_URL: "postgres://secret",
    });

    expect(env).toEqual({
      appUrl: "https://preview.example.com",
      supabaseUrl: "https://project.supabase.co",
      supabaseAnonKey: "anon-key",
    });
  });

  it("falls back to localhost app url outside production", () => {
    const env = parseClientEnv(
      {
        NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
      },
      { nodeEnv: "development" },
    );

    expect(env.appUrl).toBe("http://127.0.0.1:3000");
  });

  it("requires database urls for server runtime", () => {
    expect(() =>
      parseServerEnv({
        NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
      }),
    ).toThrow("Missing required server environment variables: DATABASE_URL, DIRECT_URL");
  });

  it("keeps service role server-only and optional", () => {
    const env = parseServerEnv({
      NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
      DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
      DIRECT_URL: "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
      SUPABASE_SERVICE_ROLE_KEY: "service-role",
    });

    expect(env.supabaseServiceRoleKey).toBe("service-role");
    expect(env.databaseUrl).toContain("postgresql://");
    expect(env.supabaseAnonKey).toBe("anon-key");
  });

  it("accepts database variables provisioned by the Vercel Supabase integration", () => {
    const env = parseServerEnv({
      NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-key",
      POSTGRES_PRISMA_URL: "postgresql://pooler.example.test/postgres",
      POSTGRES_URL_NON_POOLING: "postgresql://db.example.test/postgres",
      SUPABASE_SERVICE_ROLE_KEY: "service-role",
    });

    expect(env.databaseUrl).toBe("postgresql://pooler.example.test/postgres");
    expect(env.directUrl).toBe("postgresql://db.example.test/postgres");
    expect(env.supabaseAnonKey).toBe("publishable-key");
  });
});
