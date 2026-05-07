import { spawnSync } from "node:child_process";
import path from "node:path";

const scriptPath = path.join(process.cwd(), "scripts", "import-output.js");
const result = spawnSync(process.execPath, [scriptPath], {
  stdio: "inherit",
  env: process.env,
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
