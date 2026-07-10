import fs from "node:fs/promises";
import path from "node:path";

type Row = Record<string, unknown>;

type TransformResult = {
  sourceTable: string;
  targetTable: string;
  rowCount: number;
  outputPath: string;
};

const TABLE_MAP: Record<string, string> = {
  cloudflare_auth_user: "profiles",
  organization: "organizations",
  organization_member: "organization_members",
  file_asset: "file_assets",
  conversation: "inbox_threads",
  conversation_message: "inbox_messages",
  training_chat: "training_rooms",
  training_message: "training_messages",
};

function readOption(name: string) {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function hasFlag(name: string) {
  return process.argv.includes(`--${name}`);
}

function printHelp() {
  console.log(`Usage: npx tsx scripts/transform-d1-to-postgres.ts [options]

Options:
  --input=<dir>           D1 export directory containing manifest.json. Default: artifacts/d1-export
  --out=<dir>             JSONL output directory. Default: artifacts/postgres-import
  --dry-run               Print planned transformations without reading table dumps.
  --help                  Show this help text.
`);
}

function asRecord(value: unknown): Row | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Row) : null;
}

function extractArrayRows(entries: unknown[]): Row[] {
  return entries.flatMap((entry) => {
    const nestedRows = extractRows(entry);
    if (nestedRows.length > 0) return nestedRows;

    const record = asRecord(entry);
    return record ? [record] : [];
  });
}

function extractRows(payload: unknown): Row[] {
  if (Array.isArray(payload)) {
    return extractArrayRows(payload);
  }

  const record = asRecord(payload);
  if (!record) return [];

  if (Array.isArray(record.results)) return extractArrayRows(record.results);
  if (Array.isArray(record.result)) return extractArrayRows(record.result);
  if (Array.isArray(record.rows)) return extractArrayRows(record.rows);

  return [];
}

function toIso(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
}

function toBoolean(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") return ["1", "true", "yes"].includes(value.toLowerCase());
  return false;
}

function toJsonObject(value: unknown): Row {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) return value as Row;
  if (typeof value !== "string") return {};

  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Row) : {};
  } catch {
    return {};
  }
}

function normalizeRow(sourceTable: string, row: Row): Row {
  if (sourceTable === "cloudflare_auth_user") {
    return {
      id: row.auth_user_id ?? row.id,
      email: typeof row.email === "string" ? row.email.toLowerCase() : row.email,
      display_name: row.display_name ?? null,
      created_at: toIso(row.created_at),
      updated_at: toIso(row.updated_at),
    };
  }

  if (sourceTable === "organization") {
    return {
      id: row.id,
      slug: row.slug ?? row.code ?? row.id,
      name: row.name,
      created_by: row.created_by ?? row.owner_user_id ?? null,
      created_at: toIso(row.created_at),
      updated_at: toIso(row.updated_at),
      archived_at: toIso(row.archived_at),
    };
  }

  if (sourceTable === "organization_member") {
    return {
      organization_id: row.organization_id,
      user_id: row.user_id ?? row.auth_user_id,
      role: row.role ?? "member",
      status: toBoolean(row.is_active ?? true) ? "active" : "disabled",
      created_at: toIso(row.created_at),
      updated_at: toIso(row.updated_at),
    };
  }

  if (sourceTable === "file_asset") {
    return {
      id: row.id,
      organization_id: row.organization_id,
      owner_user_id: row.owner_user_id ?? row.uploaded_by_user_id,
      bucket_id: row.bucket ?? row.bucket_id ?? "documents",
      object_path: row.object_key ?? row.r2_key ?? row.object_path,
      file_name: row.file_name,
      mime_type: row.mime_type,
      size_bytes: row.size_bytes,
      visibility: row.visibility ?? "organization",
      created_at: toIso(row.created_at),
      updated_at: toIso(row.updated_at),
    };
  }

  if (sourceTable === "conversation") {
    return {
      id: row.id,
      organization_id: row.organization_id,
      subject: row.subject ?? row.external_thread_id ?? null,
      status: row.status ?? "active",
      created_at: toIso(row.created_at),
      updated_at: toIso(row.updated_at),
      last_message_at: toIso(row.last_message_at),
    };
  }

  if (sourceTable === "conversation_message") {
    return {
      id: row.id,
      thread_id: row.conversation_id ?? row.thread_id,
      organization_id: row.organization_id,
      sender_user_id: row.sender_user_id ?? row.user_id,
      body: row.body ?? row.text ?? "",
      metadata: toJsonObject(row.metadata_json ?? row.metadata),
      created_at: toIso(row.created_at),
      updated_at: toIso(row.updated_at),
    };
  }

  if (sourceTable === "training_chat") {
    return {
      id: row.id,
      organization_id: row.organization_id,
      name: row.name ?? row.title ?? "Training room",
      created_by: row.created_by ?? row.user_id ?? null,
      created_at: toIso(row.created_at),
      updated_at: toIso(row.updated_at),
    };
  }

  if (sourceTable === "training_message") {
    return {
      id: row.id,
      room_id: row.training_chat_id ?? row.room_id,
      organization_id: row.organization_id,
      sender_user_id: row.sender_user_id ?? row.user_id,
      body: row.body ?? row.text ?? row.content ?? "",
      metadata: toJsonObject(row.metadata_json ?? row.metadata),
      created_at: toIso(row.created_at),
      updated_at: toIso(row.updated_at),
    };
  }

  return row;
}

async function readJson(filePath: string) {
  const source = await fs.readFile(filePath, "utf8");
  return JSON.parse(source) as unknown;
}

async function main() {
  if (hasFlag("help")) {
    printHelp();
    return;
  }

  const inputDir = readOption("input") ?? "artifacts/d1-export";
  const outputDir = readOption("out") ?? "artifacts/postgres-import";
  const dryRun = hasFlag("dry-run");
  const manifestPath = path.join(inputDir, "manifest.json");
  const manifest = asRecord(await readJson(manifestPath));
  const tables = Array.isArray(manifest?.tables)
    ? manifest.tables.filter((table): table is string => typeof table === "string")
    : Object.keys(TABLE_MAP);
  const results: TransformResult[] = [];

  await fs.mkdir(outputDir, { recursive: true });

  for (const sourceTable of tables) {
    const targetTable = TABLE_MAP[sourceTable];
    if (!targetTable) {
      console.log(`[skip] No target mapping for ${sourceTable}`);
      continue;
    }

    const inputPath = path.join(inputDir, `${sourceTable}.json`);
    const outputPath = path.join(outputDir, `${targetTable}.jsonl`);

    if (dryRun) {
      console.log(`[dry-run] ${inputPath} -> ${outputPath}`);
      results.push({ sourceTable, targetTable, rowCount: 0, outputPath });
      continue;
    }

    const rows = extractRows(await readJson(inputPath)).map((row) => normalizeRow(sourceTable, row));
    const jsonl = rows.map((row) => JSON.stringify(row)).join("\n");
    await fs.writeFile(outputPath, jsonl ? `${jsonl}\n` : "", "utf8");
    console.log(`[transform] ${sourceTable} -> ${targetTable}: ${rows.length} rows`);
    results.push({ sourceTable, targetTable, rowCount: rows.length, outputPath });
  }

  await fs.writeFile(
    path.join(outputDir, "manifest.json"),
    `${JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2)}\n`,
    "utf8",
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[error] ${message}`);
  process.exit(1);
});
