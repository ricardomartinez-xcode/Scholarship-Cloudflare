import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const rootDir = process.cwd();

describe("repo operations", () => {
  it("exposes the requested check script as a reproducible local gate", () => {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(rootDir, "package.json"), "utf8"),
    ) as { scripts?: Record<string, string> };

    expect(packageJson.scripts?.check).toBe("npm run lint && npm run typecheck && npm test");
  });

  it("pins npm in Node 22 GitHub Actions workflows", () => {
    const workflowPaths = [
      ".github/workflows/quality-release-gate.yml",
      ".github/workflows/cloudflare-preflight.yml",
      ".github/workflows/cloudflare-workers.yml",
      ".github/workflows/cloudflare-d1-migrations.yml",
      ".github/workflows/d1-migration-readiness.yml",
    ];

    for (const workflowPath of workflowPaths) {
      const source = fs.readFileSync(path.join(rootDir, workflowPath), "utf8");
      expect(source).toContain("node-version: 22");
      expect(source).toContain("npm install -g npm@11.12.1");
      expect(source).toContain("node --version");
      expect(source).toContain("npm --version");
      expect(source).toContain("npm ci --foreground-scripts");
    }
  });

  it("keeps Cloudflare runtime routes from statically importing Prisma services", () => {
    const routePaths = [
      "apps/web/src/app/api/data/benefits/route.ts",
      "apps/web/src/app/api/data/pricing-options/route.ts",
      "apps/web/src/app/api/data/simulador/route.ts",
      "apps/web/src/app/api/unidep/inbox/threads/route.ts",
      "apps/web/src/app/api/unidep/inbox/threads/[threadId]/route.ts",
      "apps/web/src/app/api/unidep/inbox/threads/[threadId]/messages/route.ts",
      "apps/web/src/app/api/ext/campaigns/media/route.ts",
    ];

    for (const routePath of routePaths) {
      const source = fs.readFileSync(path.join(rootDir, routePath), "utf8");
      expect(source).not.toMatch(/^import\s+.*["@']@\/lib\/prisma["@'];/m);
      expect(source).not.toMatch(/^import\s+.*["@']@\/lib\/inbox-service["@'];/m);
    }
  });

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
