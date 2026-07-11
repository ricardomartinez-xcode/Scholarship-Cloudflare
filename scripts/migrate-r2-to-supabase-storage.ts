import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

type SourceObject = {
  key: string;
  targetKey?: string;
  bucket?: string;
  targetBucket?: string;
  sourcePath?: string;
  sourceUrl?: string;
  contentType?: string;
  mimeType?: string;
  sizeBytes?: number;
  sha256?: string;
};

type Result = {
  key: string;
  targetKey: string;
  targetBucket: string;
  status:
    | "planned"
    | "uploaded"
    | "duplicate"
    | "missing_source"
    | "invalid_hash"
    | "invalid_size"
    | "failed";
  sizeBytes?: number;
  contentType?: string;
  sha256?: string;
  error?: string;
};

function readOption(name: string) {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function hasFlag(name: string) {
  return process.argv.includes(`--${name}`);
}

function printHelp() {
  console.log(`Usage: npx tsx scripts/migrate-r2-to-supabase-storage.ts [options]

Options:
  --manifest=<file>       Source object manifest. Default: artifacts/r2-storage-export/manifest.json
  --out=<file>            JSON report path. Default: artifacts/storage-migration-report.json
  --bucket=<name>         Default Supabase Storage bucket. Default: documents
  --retries=<number>      Upload retry attempts. Default: 3
  --dry-run               Print and write a planned report without writing. Default.
  --apply                 Upload to Supabase staging using NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
  --verify-download       Download uploaded object and compare size/hash after upload.
  --help                  Show this help text.

Manifest shape:
  { "objects": [{ "key": "old/r2/key.pdf", "sourcePath": "artifacts/r2/key.pdf", "contentType": "application/pdf" }] }

Each object may use sourcePath or sourceUrl. The script does not call Cloudflare R2 APIs directly.
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

async function readManifest(filePath: string) {
  const payload = await readJson<SourceObject[] | { objects?: SourceObject[] }>(filePath);
  const objects = Array.isArray(payload) ? payload : payload.objects;
  if (!Array.isArray(objects)) {
    throw new Error("Manifest must be an array or an object with an objects array.");
  }
  return objects;
}

function isNotFoundError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "ENOENT"
  );
}

function normalizeTargetKey(entry: SourceObject) {
  return (entry.targetKey ?? entry.key).replace(/^\/+|\/+$/g, "");
}

function inferContentType(entry: SourceObject) {
  if (entry.contentType) return entry.contentType;
  if (entry.mimeType) return entry.mimeType;
  const extension = entry.key.split(".").pop()?.toLowerCase();
  if (extension === "pdf") return "application/pdf";
  if (extension === "png") return "image/png";
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "webp") return "image/webp";
  if (extension === "mp4") return "video/mp4";
  if (extension === "webm") return "video/webm";
  return "application/octet-stream";
}

function sha256(buffer: Buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

async function readSource(entry: SourceObject) {
  if (entry.sourcePath) {
    return fs.readFile(entry.sourcePath);
  }

  if (entry.sourceUrl) {
    const response = await fetch(entry.sourceUrl, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`sourceUrl returned HTTP ${response.status}`);
    }
    return Buffer.from(await response.arrayBuffer());
  }

  return null;
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetries<T>(attempts: number, operation: () => Promise<T>) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await sleep(250 * attempt);
    }
  }
  throw lastError;
}

async function writeReport(outPath: string, results: Result[], dryRun: boolean) {
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(
    outPath,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        dryRun,
        summary: {
          total: results.length,
          planned: results.filter((entry) => entry.status === "planned").length,
          uploaded: results.filter((entry) => entry.status === "uploaded").length,
          duplicate: results.filter((entry) => entry.status === "duplicate").length,
          failed: results.filter((entry) => entry.status === "failed").length,
          missingSource: results.filter((entry) => entry.status === "missing_source").length,
          invalidHash: results.filter((entry) => entry.status === "invalid_hash").length,
          invalidSize: results.filter((entry) => entry.status === "invalid_size").length,
        },
        results,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}

async function main() {
  if (hasFlag("help")) {
    printHelp();
    return;
  }

  const manifestPath = readOption("manifest") ?? "artifacts/r2-storage-export/manifest.json";
  const outPath = readOption("out") ?? "artifacts/storage-migration-report.json";
  const defaultBucket = readOption("bucket") ?? "documents";
  const retries = parsePositiveInteger(readOption("retries"), 3);
  const dryRun = hasFlag("dry-run") || !hasFlag("apply");
  const verifyDownload = hasFlag("verify-download");
  const objects = await readManifest(manifestPath).catch((error: unknown) => {
    if (dryRun && isNotFoundError(error)) {
      console.log(`[dry-run] Manifest not found at ${manifestPath}; writing an empty report.`);
      return [];
    }
    throw error;
  });
  const seenTargets = new Set<string>();
  const results: Result[] = [];

  const supabase = dryRun
    ? null
    : createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
        auth: {
          autoRefreshToken: false,
          detectSessionInUrl: false,
          persistSession: false,
        },
      });

  for (const entry of objects) {
    const targetBucket = entry.targetBucket ?? entry.bucket ?? defaultBucket;
    const targetKey = normalizeTargetKey(entry);
    const targetId = `${targetBucket}/${targetKey}`;
    const contentType = inferContentType(entry);

    if (seenTargets.has(targetId)) {
      results.push({
        key: entry.key,
        targetBucket,
        targetKey,
        status: "duplicate",
        contentType,
      });
      continue;
    }
    seenTargets.add(targetId);

    if (dryRun) {
      results.push({
        key: entry.key,
        targetBucket,
        targetKey,
        status: entry.sourcePath || entry.sourceUrl ? "planned" : "missing_source",
        sizeBytes: entry.sizeBytes,
        contentType,
        sha256: entry.sha256,
      });
      continue;
    }

    try {
      const source = await readSource(entry);
      if (!source) {
        results.push({ key: entry.key, targetBucket, targetKey, status: "missing_source" });
        continue;
      }

      const actualHash = sha256(source);
      if (entry.sha256 && actualHash !== entry.sha256) {
        results.push({
          key: entry.key,
          targetBucket,
          targetKey,
          status: "invalid_hash",
          sizeBytes: source.byteLength,
          contentType,
          sha256: actualHash,
        });
        continue;
      }

      if (typeof entry.sizeBytes === "number" && source.byteLength !== entry.sizeBytes) {
        results.push({
          key: entry.key,
          targetBucket,
          targetKey,
          status: "invalid_size",
          sizeBytes: source.byteLength,
          contentType,
          sha256: actualHash,
        });
        continue;
      }

      await withRetries(retries, async () => {
        const { error } = await supabase!.storage.from(targetBucket).upload(targetKey, source, {
          contentType,
          upsert: false,
        });
        if (error) throw new Error(error.message);
      });

      if (verifyDownload) {
        const { data, error } = await supabase!.storage.from(targetBucket).download(targetKey);
        if (error) throw new Error(`verification download failed: ${error.message}`);
        const downloaded = Buffer.from(await data.arrayBuffer());
        if (downloaded.byteLength !== source.byteLength || sha256(downloaded) !== actualHash) {
          throw new Error("verification mismatch after upload");
        }
      }

      results.push({
        key: entry.key,
        targetBucket,
        targetKey,
        status: "uploaded",
        sizeBytes: source.byteLength,
        contentType,
        sha256: actualHash,
      });
    } catch (error) {
      results.push({
        key: entry.key,
        targetBucket,
        targetKey,
        status: "failed",
        contentType,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  await writeReport(outPath, results, dryRun);
  for (const result of results) {
    console.log(`[${result.status}] ${result.targetBucket}/${result.targetKey}`);
  }
  console.log(`[done] Report written to ${outPath}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[error] ${message}`);
  process.exit(1);
});
