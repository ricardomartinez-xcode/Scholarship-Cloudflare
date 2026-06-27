import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";

const outDir = path.resolve(process.cwd(), ".wrangler-bundle");
const metafile = path.join(outDir, "meta.json");
const bundledWorker = path.join(outDir, "worker.js");
const deployWorker = path.join(outDir, "worker.terser.js");
const freeWorkerGzipLimitBytes = 3 * 1024 * 1024;

function quoteArg(value) {
  return `"${String(value).replace(/"/g, '\\"')}"`;
}

function run(command, args) {
  const commandLine = [command, ...args.map(quoteArg)].join(" ");
  const result = spawnSync(commandLine, {
    cwd: process.cwd(),
    shell: true,
    stdio: "inherit",
    env: process.env,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function kib(bytes) {
  return (bytes / 1024).toFixed(2);
}

rmSync(outDir, { recursive: true, force: true });

run("npx", [
  "wrangler",
  "deploy",
  "--dry-run",
  "--minify",
  "--outdir",
  outDir,
  "--metafile",
  metafile,
]);

if (!existsSync(bundledWorker)) {
  throw new Error(`Wrangler did not write ${bundledWorker}`);
}

run("npx", [
  "terser",
  bundledWorker,
  "--module",
  "-c",
  "passes=2",
  "-m",
  "-o",
  deployWorker,
]);

const workerBytes = readFileSync(deployWorker);
const gzipBytes = gzipSync(workerBytes).length;

console.log(
  `Prepared ${path.relative(process.cwd(), deployWorker)}: ${kib(workerBytes.length)} KiB / gzip ${kib(gzipBytes)} KiB`,
);

if (gzipBytes > freeWorkerGzipLimitBytes) {
  console.error(
    `Cloudflare Worker gzip size ${kib(gzipBytes)} KiB exceeds the Free limit of ${kib(freeWorkerGzipLimitBytes)} KiB.`,
  );
  process.exit(1);
}
