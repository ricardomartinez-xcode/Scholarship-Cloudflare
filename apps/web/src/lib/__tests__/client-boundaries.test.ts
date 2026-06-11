import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const rootDir = process.cwd();

function walkSourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return walkSourceFiles(fullPath);
    return /\.(ts|tsx)$/.test(entry.name) ? [fullPath] : [];
  });
}

function isClientModule(source: string) {
  return /^["']use client["'];?/m.test(source);
}

describe("client module boundaries", () => {
  it("does not bundle Prisma runtime into client components", () => {
    const files = walkSourceFiles(path.join(rootDir, "apps/web/src"));
    const offenders = files.flatMap((file) => {
      const source = fs.readFileSync(file, "utf8");
      if (!isClientModule(source)) return [];

      const runtimePrismaImports = source
        .split(/\r?\n/)
        .map((line, index) => ({ line, number: index + 1 }))
        .filter(({ line }) => /from\s+["']@prisma\/client["']/.test(line))
        .filter(({ line }) => !/^\s*import\s+type\b/.test(line));

      return runtimePrismaImports.map(({ number, line }) => {
        const relative = path.relative(rootDir, file).replace(/\\/g, "/");
        return `${relative}:${number} ${line.trim()}`;
      });
    });

    expect(offenders).toEqual([]);
  });
});
