import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const rootDir = process.cwd();
const sourceExtensions = [".ts", ".tsx"] as const;

function walkSourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return walkSourceFiles(fullPath);
    return /\.(ts|tsx)$/.test(entry.name) ? [fullPath] : [];
  });
}

function hasDirective(source: string, directive: "use client" | "use server") {
  return new RegExp(`^["']${directive}["'];?`, "m").test(source.slice(0, 500));
}

function isTypeOnlyImport(statement: string) {
  const normalized = statement.replace(/\s+/g, " ").trim();
  if (/^import\s+type\b/.test(normalized)) return true;

  const namedImport = normalized.match(/^import\s+\{([^}]+)\}\s+from/);
  if (!namedImport) return false;

  return namedImport[1]
    .split(",")
    .every((specifier) => /^\s*type\b/.test(specifier.trim()));
}

function getRuntimeImportSpecs(source: string) {
  const imports: string[] = [];
  const importPattern =
    /\bimport\s+(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']|\bexport\s+(?:[\s\S]*?\s+from\s+)["']([^"']+)["']/g;

  let match: RegExpExecArray | null;
  while ((match = importPattern.exec(source)) !== null) {
    const spec = match[1] ?? match[2];
    if (!spec) continue;

    const statementStart = source.lastIndexOf("\n", match.index) + 1;
    const statementEnd = source.indexOf("\n", importPattern.lastIndex);
    const statement = source.slice(
      statementStart,
      statementEnd === -1 ? importPattern.lastIndex : statementEnd,
    );
    if (match[1] && isTypeOnlyImport(statement)) continue;

    imports.push(spec);
  }

  return imports;
}

function candidateFiles(basePath: string) {
  if (path.extname(basePath)) return [basePath];
  return [
    ...sourceExtensions.map((extension) => `${basePath}${extension}`),
    ...sourceExtensions.map((extension) => path.join(basePath, `index${extension}`)),
  ];
}

function resolveImportSpec(
  spec: string,
  fromFile: string,
  sourceFiles: Set<string>,
): string | null {
  if (spec === "@prisma/client" || spec === "server-only") return spec;

  if (spec.startsWith("@/")) {
    return (
      candidateFiles(path.join(rootDir, "apps/web/src", spec.slice(2)))
        .map((candidate) => path.normalize(candidate))
        .find((candidate) => sourceFiles.has(candidate)) ?? null
    );
  }

  const packageAliases: Record<string, string> = {
    "@relead/ui": "packages/ui/src/index.ts",
    "@relead/config": "packages/config/src/index.ts",
    "@relead/db": "packages/db/src/index.ts",
    "@relead/auth": "packages/auth/src/index.ts",
    "@relead/domain": "packages/domain/src/index.ts",
    "@relead/realtime": "packages/realtime/src/index.ts",
    "@relead/matricula-sdk": "packages/matricula-sdk/src/index.ts",
  };

  for (const [packageName, entrypoint] of Object.entries(packageAliases)) {
    if (spec === packageName) {
      return path.normalize(path.join(rootDir, entrypoint));
    }
    if (spec.startsWith(`${packageName}/`)) {
      const packageDir = packageName.split("/")[1];
      return (
        candidateFiles(
          path.join(rootDir, "packages", packageDir, "src", spec.slice(packageName.length + 1)),
        )
          .map((candidate) => path.normalize(candidate))
          .find((candidate) => sourceFiles.has(candidate)) ?? null
      );
    }
  }

  if (!spec.startsWith(".")) return null;

  return (
    candidateFiles(path.resolve(path.dirname(fromFile), spec))
      .map((candidate) => path.normalize(candidate))
      .find((candidate) => sourceFiles.has(candidate)) ?? null
  );
}

function formatPath(file: string) {
  return file.startsWith(rootDir)
    ? path.relative(rootDir, file).replace(/\\/g, "/")
    : file;
}

describe("client module boundaries", () => {
  it("does not bundle Prisma runtime into client components", () => {
    const files = [
      ...walkSourceFiles(path.join(rootDir, "apps/web/src")),
      ...walkSourceFiles(path.join(rootDir, "packages")),
    ].map((file) => path.normalize(file));
    const fileSet = new Set(files);
    const sourceByFile = new Map(
      files.map((file) => [file, fs.readFileSync(file, "utf8")]),
    );
    const importGraph = new Map(
      files.map((file) => [
        file,
        getRuntimeImportSpecs(sourceByFile.get(file) ?? "").map((spec) => ({
          spec,
          resolved: resolveImportSpec(spec, file, fileSet),
        })),
      ]),
    );

    const offenders: string[] = [];
    const clientFiles = files.filter((file) =>
      hasDirective(sourceByFile.get(file) ?? "", "use client"),
    );

    for (const startFile of clientFiles) {
      const queue = [{ file: startFile, path: [startFile] }];
      const seen = new Set([startFile]);

      while (queue.length > 0) {
        const current = queue.shift();
        if (!current) break;

        for (const dependency of importGraph.get(current.file) ?? []) {
          if (dependency.spec === "@prisma/client" || dependency.resolved === "@prisma/client") {
            offenders.push(
              [...current.path, "@prisma/client"].map(formatPath).join(" -> "),
            );
            continue;
          }

          if (dependency.spec === "server-only") {
            offenders.push([...current.path, "server-only"].map(formatPath).join(" -> "));
            continue;
          }

          const nextFile = dependency.resolved;
          if (!nextFile || seen.has(nextFile)) continue;

          if (hasDirective(sourceByFile.get(nextFile) ?? "", "use server")) {
            continue;
          }

          seen.add(nextFile);
          queue.push({ file: nextFile, path: [...current.path, nextFile] });
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
