import { cpSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";

import {
  exactCopyFiles,
  repoRoot,
  sourceRoot,
  variantRoots,
} from "./extension-variant-config.mjs";

const copied = [];
const failures = [];

for (const variantRoot of variantRoots) {
  for (const relativePath of exactCopyFiles) {
    const sourcePath = path.join(sourceRoot, relativePath);
    const variantPath = path.join(variantRoot, relativePath);

    if (!existsSync(sourcePath)) {
      failures.push(`missing source ${path.relative(repoRoot, sourcePath)}`);
      continue;
    }

    mkdirSync(path.dirname(variantPath), { recursive: true });
    cpSync(sourcePath, variantPath);
    copied.push(path.relative(repoRoot, variantPath));
  }
}

if (failures.length > 0) {
  console.error("Chrome extension variant sync failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(
  `Chrome extension variants synced: ${variantRoots.length} variants, ${exactCopyFiles.length} exact-copy files each.`,
);
console.log(`Managed files copied: ${copied.length}.`);
