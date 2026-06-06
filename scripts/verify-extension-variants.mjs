import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import {
  allowedVariantRoots,
  exactCopyFiles,
  repoRoot,
  sourceRoot,
  variantRoots,
} from "./extension-variant-config.mjs";

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
const variantsRoot = path.join(repoRoot, "chrome-extension", "variants");
const allowedVariantNames = new Set(
  (allowedVariantRoots ?? variantRoots).map((variantRoot) => path.basename(variantRoot)),
);

if (!existsSync(variantsRoot)) {
  failures.push(`missing variants root ${path.relative(repoRoot, variantsRoot)}`);
} else {
  const existingVariantNames = readdirSync(variantsRoot).filter((name) =>
    statSync(path.join(variantsRoot, name)).isDirectory(),
  );

  for (const variantName of existingVariantNames) {
    if (!allowedVariantNames.has(variantName)) {
      failures.push(`unexpected variant ${path.join("chrome-extension", "variants", variantName)}`);
    }
  }
}

for (const variantRoot of variantRoots) {
  if (!existsSync(variantRoot)) {
    failures.push(`missing configured variant ${path.relative(repoRoot, variantRoot)}`);
  }
}

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
