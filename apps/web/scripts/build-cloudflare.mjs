import { spawn } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";

process.env.CLOUDFLARE_BUILD = "1";

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
