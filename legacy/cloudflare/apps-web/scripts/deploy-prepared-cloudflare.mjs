import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const deployWorker = path.resolve(process.cwd(), ".wrangler-bundle/worker.terser.js");

function quoteArg(value) {
  return `"${String(value).replace(/"/g, '\\"')}"`;
}

function run(command, args) {
  const commandLine = [command, ...args.map(quoteArg)].join(" ");
  const result = spawnSync(commandLine, {
    cwd: process.cwd(),
    shell: true,
    stdio: "inherit",
    env: {
      ...process.env,
      OPEN_NEXT_DEPLOY: "true",
    },
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (!existsSync(deployWorker)) {
  throw new Error(`Prepared Worker not found at ${deployWorker}. Run npm run prepare:cloudflare first.`);
}

run("npx", ["wrangler", "deploy", deployWorker, "--no-bundle"]);
