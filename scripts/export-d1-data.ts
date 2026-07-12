import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

type CliOptions = {
  database: string;
  outputDir: string;
  tables: string[];
  dryRun: boolean;
  execute: boolean;
};

const DEFAULT_TABLES = [
  "cloudflare_auth_user",
  "organization",
  "organization_member",
  "file_asset",
  "conversation",
  "conversation_message",
  "training_chat",
  "training_message",
  "outbox_event",
];

function readOption(name: string) {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function hasFlag(name: string) {
  return process.argv.includes(`--${name}`);
}

function printHelp() {
  console.log(`Usage: npx tsx scripts/export-d1-data.ts [options]

Options:
  --database=<name>       Cloudflare D1 database name. Default: recalc-cloudflare
  --out=<dir>             Output directory. Default: artifacts/d1-export
  --tables=<a,b,c>        Comma-separated D1 tables to export.
  --dry-run               Print planned Wrangler commands without remote reads. Default.
  --execute               Execute remote D1 reads. Requires Wrangler auth and staging-safe review.
  --help                  Show this help text.
`);
}

function parseOptions(): CliOptions {
  if (hasFlag("help")) {
    printHelp();
    process.exit(0);
  }

  const tables = (readOption("tables") ?? DEFAULT_TABLES.join(","))
    .split(",")
    .map((table) => table.trim())
    .filter(Boolean);

  return {
    database: readOption("database") ?? "recalc-cloudflare",
    outputDir: readOption("out") ?? "artifacts/d1-export",
    tables,
    dryRun: hasFlag("dry-run") || !hasFlag("execute"),
    execute: hasFlag("execute"),
  };
}

function assertSafeTableName(table: string) {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table)) {
    throw new Error(`Unsafe table name: ${table}`);
  }
}

function buildCommand(database: string, table: string) {
  assertSafeTableName(table);
  return [
    "wrangler",
    "d1",
    "execute",
    database,
    "--remote",
    "--json",
    "--command",
    `SELECT * FROM "${table}"`,
  ];
}

async function writeManifest(options: CliOptions, results: Array<Record<string, unknown>>) {
  await fs.mkdir(options.outputDir, { recursive: true });
  const manifest = {
    generatedAt: new Date().toISOString(),
    database: options.database,
    dryRun: options.dryRun,
    tables: options.tables,
    results,
  };
  await fs.writeFile(
    path.join(options.outputDir, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );
}

async function main() {
  const options = parseOptions();
  const results: Array<Record<string, unknown>> = [];

  await fs.mkdir(options.outputDir, { recursive: true });

  for (const table of options.tables) {
    const command = buildCommand(options.database, table);
    const outputPath = path.join(options.outputDir, `${table}.json`);

    if (options.dryRun) {
      console.log(`[dry-run] ${command.map((part) => JSON.stringify(part)).join(" ")}`);
      results.push({ table, outputPath, status: "planned" });
      continue;
    }

    if (!options.execute) {
      throw new Error("Refusing to export without --execute. Use --dry-run for planning.");
    }

    console.log(`[export] ${table} -> ${outputPath}`);
    const result = spawnSync("npx", command, {
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 50,
    });

    if (result.status !== 0) {
      results.push({ table, outputPath, status: "failed", exitCode: result.status });
      const stderr = result.stderr.trim();
      throw new Error(`D1 export failed for ${table}${stderr ? `: ${stderr}` : ""}`);
    }

    await fs.writeFile(outputPath, result.stdout, "utf8");
    results.push({ table, outputPath, status: "exported", bytes: result.stdout.length });
  }

  await writeManifest(options, results);
  console.log(`[done] Manifest written to ${path.join(options.outputDir, "manifest.json")}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[error] ${message}`);
  process.exit(1);
});
