import fs from "node:fs/promises";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

type ManifestEntry = {
  targetTable: string;
  outputPath: string;
  rowCount: number;
};

function readOption(name: string) {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function hasFlag(name: string) {
  return process.argv.includes(`--${name}`);
}

function printHelp() {
  console.log(`Usage: npx tsx scripts/validate-migrated-data.ts [options]

Options:
  --input=<dir>           JSONL import directory containing manifest.json. Default: artifacts/postgres-import
  --remote                Compare JSONL counts with Supabase staging using service role credentials.
  --help                  Show this help text.
`);
}

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

async function readJson<T>(filePath: string): Promise<T> {
  const source = await fs.readFile(filePath, "utf8");
  return JSON.parse(source) as T;
}

async function countJsonl(filePath: string) {
  const source = await fs.readFile(filePath, "utf8");
  return source.split("\n").filter((line) => line.trim()).length;
}

async function main() {
  if (hasFlag("help")) {
    printHelp();
    return;
  }

  const inputDir = readOption("input") ?? "artifacts/postgres-import";
  const manifestPath = path.join(inputDir, "manifest.json");
  const manifest = await readJson<{ results: ManifestEntry[] }>(manifestPath);
  const checkRemote = hasFlag("remote");

  const localCounts = new Map<string, number>();
  for (const entry of manifest.results) {
    const count = await countJsonl(entry.outputPath);
    localCounts.set(entry.targetTable, count);
    const expected = entry.rowCount;
    const status = count === expected ? "ok" : "mismatch";
    console.log(`[local:${status}] ${entry.targetTable}: manifest=${expected} jsonl=${count}`);
  }

  if (!checkRemote) {
    console.log("[local] Remote Supabase counts skipped. Pass --remote to query staging.");
    return;
  }

  const supabase = createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });

  for (const entry of manifest.results) {
    const { count, error } = await supabase
      .schema("recalc_admin")
      .from(entry.targetTable)
      .select("*", { count: "exact", head: true });

    if (error) {
      throw new Error(`Remote count failed for ${entry.targetTable}: ${error.message}`);
    }

    const expected = localCounts.get(entry.targetTable) ?? entry.rowCount;
    const status = count === expected ? "ok" : "mismatch";
    console.log(`[remote:${status}] ${entry.targetTable}: expected=${expected} remote=${count ?? "unknown"}`);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[error] ${message}`);
  process.exit(1);
});
