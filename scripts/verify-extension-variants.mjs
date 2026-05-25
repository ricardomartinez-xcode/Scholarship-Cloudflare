import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = path.join(
  repoRoot,
  "apps",
  "chrome-extension",
  "recalc-sidepanel",
);
const variantRoots = [
  path.join(repoRoot, "chrome-extension", "variants", "composer-first"),
  path.join(repoRoot, "chrome-extension", "variants", "preview-first"),
];

const exactCopyFiles = [
  "panel.html",
  "panel.css",
  "injected/wa-main.js",
  "content/bridge.js",
  "lib/campaigns/buildMessage.js",
  "lib/storage/attachments.js",
  "lib/whatsapp/wa-chat.js",
  "branding/logo-recalc.png",
  "branding/logo-unidep.png",
  "icons/icon16.png",
  "icons/icon32.png",
  "icons/icon48.png",
  "icons/icon128.png",
];

function hashFile(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function verifyFile(sourcePath, variantPath) {
  if (!existsSync(sourcePath)) {
    return `missing source ${path.relative(repoRoot, sourcePath)}`;
  }
  if (!existsSync(variantPath)) {
    return `missing variant ${path.relative(repoRoot, variantPath)}`;
  }
  if (hashFile(sourcePath) !== hashFile(variantPath)) {
    return `drift ${path.relative(repoRoot, variantPath)}`;
  }
  return null;
}

const failures = [];

for (const variantRoot of variantRoots) {
  for (const relativePath of exactCopyFiles) {
    const failure = verifyFile(
      path.join(sourceRoot, relativePath),
      path.join(variantRoot, relativePath),
    );
    if (failure) {
      failures.push(failure);
    }
  }
}

if (failures.length > 0) {
  console.error("Chrome extension variants are out of sync:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(
  `Chrome extension variants verified: ${variantRoots.length} variants, ${exactCopyFiles.length} exact-copy files each.`,
);
