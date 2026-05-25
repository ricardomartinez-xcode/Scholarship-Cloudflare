import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const roots = ["apps", "packages", "scripts"];
const sourceExtensions = new Set([".css", ".js", ".mjs", ".ts", ".tsx"]);
const ignoredDirectories = new Set([
  ".git",
  ".next",
  "coverage",
  "dist",
  "node_modules",
]);
const limit = Number(
  process.argv.find((arg) => arg.startsWith("--limit="))?.split("=")[1] ?? "25",
);
const minLines = Number(
  process.argv.find((arg) => arg.startsWith("--min-lines="))?.split("=")[1] ??
    "800",
);

function collectFiles(directory, files = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) {
        collectFiles(path.join(directory, entry.name), files);
      }
      continue;
    }

    if (entry.isFile() && sourceExtensions.has(path.extname(entry.name))) {
      files.push(path.join(directory, entry.name));
    }
  }

  return files;
}

function countLines(filePath) {
  const content = readFileSync(filePath, "utf8");
  if (!content) return 0;
  return content.split(/\r?\n/).length;
}

const rows = roots
  .flatMap((root) => collectFiles(path.join(repoRoot, root)))
  .map((filePath) => ({
    path: path.relative(repoRoot, filePath),
    lines: countLines(filePath),
  }))
  .filter((row) => row.lines >= minLines)
  .sort((left, right) => right.lines - left.lines)
  .slice(0, limit);

console.log(`Large source files (min ${minLines} lines, top ${limit})`);
for (const row of rows) {
  console.log(`${String(row.lines).padStart(5, " ")}  ${row.path}`);
}
