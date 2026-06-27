import { spawn } from "node:child_process";

process.env.CLOUDFLARE_BUILD = "1";

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
