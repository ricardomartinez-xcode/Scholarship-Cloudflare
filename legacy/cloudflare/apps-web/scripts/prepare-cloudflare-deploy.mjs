import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";

const outDir = path.resolve(process.cwd(), ".wrangler-bundle");
const metafile = path.join(outDir, "meta.json");
const bundledWorker = path.join(outDir, "worker.js");
const deployWorker = path.join(outDir, "worker.terser.js");
const WORKERS_PAID_GZIP_LIMIT_BYTES = 10 * 1024 * 1024;
const workerGzipLimitBytes =
  Number(process.env.CLOUDFLARE_WORKER_GZIP_LIMIT_BYTES) || WORKERS_PAID_GZIP_LIMIT_BYTES;
const extraTerserEnabled = process.env.CLOUDFLARE_EXTRA_TERSER === "1";

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

let workerBytes = readFileSync(bundledWorker);
let gzipBytes = gzipSync(workerBytes).length;

if (!extraTerserEnabled && gzipBytes <= workerGzipLimitBytes) {
  copyFileSync(bundledWorker, deployWorker);
} else {
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

  workerBytes = readFileSync(deployWorker);
  gzipBytes = gzipSync(workerBytes).length;
}

console.log(
  `Prepared ${path.relative(process.cwd(), deployWorker)}: ${kib(workerBytes.length)} KiB / gzip ${kib(gzipBytes)} KiB`,
);
console.log(
  `Configured Cloudflare Worker gzip limit: ${kib(workerGzipLimitBytes)} KiB`,
);

if (gzipBytes > workerGzipLimitBytes) {
  console.error(
    `Cloudflare Worker gzip size ${kib(gzipBytes)} KiB exceeds the configured limit of ${kib(workerGzipLimitBytes)} KiB.`,
  );
  process.exit(1);
}
