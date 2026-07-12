import { spawn, spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";

const appRoot = process.cwd();
const repoRoot = path.resolve(appRoot, "../..");

function npmCommand() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

function runRequired(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? process.cwd(),
    stdio: "inherit",
    env: {
      ...process.env,
      ...(options.env ?? {}),
    },
  });

  if (result.signal) {
    process.kill(process.pid, result.signal);
    return;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log("[cloudflare-build] Generating Prisma Client from packages/db/prisma/schema.prisma.");
runRequired(npmCommand(), ["run", "db:generate"], { cwd: repoRoot });

if (process.env.CLOUDFLARE_SKIP_EXPLICIT_TYPECHECK !== "1") {
  console.log("[cloudflare-build] Running repository typecheck before OpenNext build.");
  runRequired(npmCommand(), ["run", "typecheck"], { cwd: repoRoot });
}

process.env.CLOUDFLARE_BUILD = "1";
process.env.CLOUDFLARE_NEXT_SKIP_TYPECHECK = "1";

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function removeBuildDir(dir) {
  const target = path.resolve(process.cwd(), dir);

  for (let attempt = 1; attempt <= 6; attempt += 1) {
    try {
      rmSync(target, {
        recursive: true,
        force: true,
        maxRetries: 5,
        retryDelay: 500,
      });
      return;
    } catch (error) {
      if (attempt === 6) {
        throw error;
      }
      console.warn(`Could not remove ${dir}; retrying (${attempt}/6).`);
      sleep(1000);
    }
  }
}

for (const dir of [".next", ".open-next"]) {
  removeBuildDir(dir);
}

const child = spawn("opennextjs-cloudflare build", {
  stdio: "inherit",
  shell: true,
  env: process.env,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
