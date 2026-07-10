import fs from "node:fs/promises";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

type Row = Record<string, unknown>;

type ManifestEntry = {
  targetTable: string;
  outputPath: string;
  rowCount: number;
};

const ON_CONFLICT: Record<string, string> = {
  profiles: "id",
  organizations: "id",
  organization_members: "organization_id,user_id",
  file_assets: "id",
  inbox_threads: "id",
  inbox_messages: "id",
  training_rooms: "id",
  training_messages: "id",
};

function readOption(name: string) {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function hasFlag(name: string) {
  return process.argv.includes(`--${name}`);
}

function printHelp() {
  console.log(`Usage: npx tsx scripts/import-supabase-data.ts [options]

Options:
  --input=<dir>           JSONL import directory containing manifest.json. Default: artifacts/postgres-import
  --batch-size=<number>   Upsert batch size. Default: 250
  --dry-run               Print planned imports without writing. Default.
  --apply                 Write rows to Supabase staging using NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
  --help                  Show this help text.
`);
}

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function parsePositiveInteger(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

async function readJson<T>(filePath: string): Promise<T> {
  const source = await fs.readFile(filePath, "utf8");
  return JSON.parse(source) as T;
}

async function readJsonl(filePath: string): Promise<Row[]> {
  const source = await fs.readFile(filePath, "utf8");
  return source
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Row);
}

function chunkRows(rows: Row[], size: number) {
  const chunks: Row[][] = [];
  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size));
  }
  return chunks;
}

async function main() {
  if (hasFlag("help")) {
    printHelp();
    return;
  }

  const inputDir = readOption("input") ?? "artifacts/postgres-import";
  const batchSize = parsePositiveInteger(readOption("batch-size"), 250);
  const dryRun = hasFlag("dry-run") || !hasFlag("apply");
  const manifestPath = path.join(inputDir, "manifest.json");
  const manifest = await readJson<{ results: ManifestEntry[] }>(manifestPath);

  if (dryRun) {
    for (const entry of manifest.results) {
      console.log(`[dry-run] ${entry.targetTable}: ${entry.rowCount} rows from ${entry.outputPath}`);
    }
    console.log("[dry-run] No rows imported. Pass --apply to write to Supabase staging.");
    return;
  }

  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });

  for (const entry of manifest.results) {
    const rows = await readJsonl(entry.outputPath);
    const chunks = chunkRows(rows, batchSize);
    let imported = 0;

    for (const chunk of chunks) {
      const { error } = await supabase
        .schema("recalc_admin")
        .from(entry.targetTable)
        .upsert(chunk, { onConflict: ON_CONFLICT[entry.targetTable] });

      if (error) {
        throw new Error(`Import failed for ${entry.targetTable}: ${error.message}`);
      }

      imported += chunk.length;
      console.log(`[import] ${entry.targetTable}: ${imported}/${rows.length}`);
    }
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[error] ${message}`);
  process.exit(1);
});
