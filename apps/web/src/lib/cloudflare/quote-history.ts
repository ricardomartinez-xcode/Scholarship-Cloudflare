import { d1All } from "@/lib/cloudflare/d1";
import { d1First, d1Run } from "@/lib/cloudflare/d1";
import type {
  QuoteHistorySavePayload,
  QuoteHistorySaveResponse,
  QuoteHistoryScenarioRecord,
  QuoteHistorySessionRecord,
} from "@/lib/quote-history-types";

type D1QuoteSessionRow = {
  id?: string;
  public_id: string;
  created_at: string;
  updated_at: string;
  latest_label: string | null;
  latest_total_mxn: number | null;
};

type D1QuoteScenarioRow = {
  id: string;
  quote_session_id: string;
  sequence: number;
  label: string | null;
  input_json: string;
  result_json: string;
  total_amount: number | null;
  created_at: string;
};

export async function listD1RecentQuoteSessions(userId: string, limit = 8) {
  const safeLimit = Math.min(Math.max(limit, 1), 20);
  const rows = await d1All<D1QuoteSessionRow>(
    `SELECT q.public_token_hash AS public_id, q.created_at, q.updated_at,
            (SELECT s.label
               FROM quote_scenario s
              WHERE s.quote_session_id = q.id
              ORDER BY s.created_at DESC
              LIMIT 1) AS latest_label,
            (SELECT s.total_amount
               FROM quote_scenario s
              WHERE s.quote_session_id = q.id
              ORDER BY s.created_at DESC
              LIMIT 1) AS latest_total_mxn
       FROM quote_session q
      WHERE q.created_by_user_id = ?
      ORDER BY q.updated_at DESC
      LIMIT ?`,
    [userId, safeLimit],
  );
  return rows.map((row) => ({
    publicId: row.public_id,
    quoteMode: "canonical",
    updatedAt: row.updated_at,
    latestScenarioLabel: row.latest_label || "Cotización actual",
    latestCampusName: null,
    latestProgramName: null,
    latestTotalMxn: row.latest_total_mxn === null ? null : Number(row.latest_total_mxn),
  }));
}

function nowIso() {
  return new Date().toISOString();
}

function randomPublicId() {
  return crypto.randomUUID();
}

function parseJsonRecord<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function scenarioKind(label: string | null): "DRAFT" | "SAVED" {
  return label === "Autosave" ? "DRAFT" : "SAVED";
}

function mapScenario(row: D1QuoteScenarioRow): QuoteHistoryScenarioRecord {
  const input = parseJsonRecord(row.input_json, null);
  return {
    id: row.id,
    label: row.label || "Cotización",
    kind: scenarioKind(row.label),
    campusNameSnapshot:
      input && typeof input === "object"
        ? String((input as Record<string, unknown>).campus ?? "").trim() || null
        : null,
    programNameSnapshot:
      input && typeof input === "object"
        ? String((input as Record<string, unknown>).selectedProgramName ?? "").trim() || null
        : null,
    createdAt: row.created_at,
    updatedAt: row.created_at,
    input: parseJsonRecord(row.input_json, {} as QuoteHistoryScenarioRecord["input"]),
    result: parseJsonRecord(row.result_json, {} as QuoteHistoryScenarioRecord["result"]),
  };
}

async function readSessionWithScenarios(
  userId: string,
  sessionId: string,
): Promise<QuoteHistorySessionRecord | null> {
  const session = await d1First<{
    id: string;
    public_token_hash: string;
    created_at: string;
    updated_at: string;
  }>(
    `SELECT id, public_token_hash, created_at, updated_at
       FROM quote_session
      WHERE id = ? AND created_by_user_id = ?
      LIMIT 1`,
    [sessionId, userId],
  );
  if (!session) return null;

  const scenarios = await d1All<D1QuoteScenarioRow>(
    `SELECT id, quote_session_id, sequence, label, input_json, result_json, total_amount, created_at
       FROM quote_scenario
      WHERE quote_session_id = ?
      ORDER BY created_at DESC, sequence DESC
      LIMIT 50`,
    [session.id],
  );

  return {
    publicId: session.public_token_hash,
    quoteMode: "canonical",
    createdAt: session.created_at,
    updatedAt: session.updated_at,
    lastOpenedAt: null,
    scenarios: scenarios.map(mapScenario),
  };
}

export async function saveD1QuoteScenarioForUser(
  userId: string,
  payload: QuoteHistorySavePayload,
): Promise<QuoteHistorySaveResponse> {
  const timestamp = nowIso();
  const existingSession = payload.sessionPublicId
    ? await d1First<{ id: string }>(
        `SELECT id
           FROM quote_session
          WHERE public_token_hash = ? AND created_by_user_id = ?
          LIMIT 1`,
        [payload.sessionPublicId, userId],
      )
    : null;

  const sessionId = existingSession?.id ?? crypto.randomUUID();
  const publicId = payload.sessionPublicId || randomPublicId();
  const inputJson = JSON.stringify(payload.input);
  const resultJson = JSON.stringify(payload.result);

  if (existingSession?.id) {
    await d1Run(
      `UPDATE quote_session
          SET enrollment_type = ?,
              business_line = ?,
              modality = ?,
              plan = ?,
              campus_key = ?,
              average = ?,
              subject_count = ?,
              input_json = ?,
              updated_at = ?
        WHERE id = ?`,
      [
        payload.input.enrollmentType,
        payload.input.businessLine,
        payload.input.modality,
        payload.input.plan,
        payload.input.campus,
        payload.input.average,
        payload.input.subjectCount,
        inputJson,
        timestamp,
        sessionId,
      ],
    );
  } else {
    await d1Run(
      `INSERT INTO quote_session
        (id, public_token_hash, created_by_user_id, enrollment_type, business_line, modality,
         plan, campus_key, average, subject_count, input_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sessionId,
        publicId,
        userId,
        payload.input.enrollmentType,
        payload.input.businessLine,
        payload.input.modality,
        payload.input.plan,
        payload.input.campus,
        payload.input.average,
        payload.input.subjectCount,
        inputJson,
        timestamp,
        timestamp,
      ],
    );
  }

  const autosaveLabel = "Autosave";
  const label =
    payload.mode === "autosave"
      ? autosaveLabel
      : payload.label?.trim() || "Cotización guardada";
  const existingAutosave =
    payload.mode === "autosave"
      ? await d1First<{ id: string; sequence: number }>(
          `SELECT id, sequence
             FROM quote_scenario
            WHERE quote_session_id = ? AND label = ?
            ORDER BY created_at DESC
            LIMIT 1`,
          [sessionId, autosaveLabel],
        )
      : null;
  const nextSequence =
    existingAutosave?.sequence ??
    Number(
      (
        await d1First<{ next_sequence: number }>(
          "SELECT COALESCE(MAX(sequence), 0) + 1 AS next_sequence FROM quote_scenario WHERE quote_session_id = ?",
          [sessionId],
        )
      )?.next_sequence ?? 1,
    );
  const savedScenarioId = existingAutosave?.id ?? crypto.randomUUID();

  if (existingAutosave?.id) {
    await d1Run(
      `UPDATE quote_scenario
          SET input_json = ?,
              pricing_snapshot_json = ?,
              scholarship_snapshot_json = ?,
              result_json = ?,
              total_amount = ?,
              created_at = ?
        WHERE id = ?`,
      [
        inputJson,
        JSON.stringify({ quoteMode: payload.quoteMode }),
        "{}",
        resultJson,
        payload.result.totalMxn,
        timestamp,
        savedScenarioId,
      ],
    );
  } else {
    await d1Run(
      `INSERT INTO quote_scenario
        (id, quote_session_id, sequence, label, is_selected, input_json, pricing_snapshot_json,
         scholarship_snapshot_json, result_json, total_amount, currency, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'MXN', ?)`,
      [
        savedScenarioId,
        sessionId,
        nextSequence,
        label,
        payload.mode === "snapshot" ? 1 : 0,
        inputJson,
        JSON.stringify({ quoteMode: payload.quoteMode }),
        "{}",
        resultJson,
        payload.result.totalMxn,
        timestamp,
      ],
    );
  }

  await d1Run(
    `INSERT INTO quote_event
      (id, quote_session_id, scenario_id, event_type, actor_user_id, event_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      crypto.randomUUID(),
      sessionId,
      savedScenarioId,
      payload.mode === "autosave" ? "input_updated" : "scenario_created",
      userId,
      JSON.stringify({ source: "cloudflare_d1", mode: payload.mode }),
      timestamp,
    ],
  );

  const session = await readSessionWithScenarios(userId, sessionId);
  if (!session) {
    throw new Error("No fue posible leer la sesión guardada en D1.");
  }

  return {
    changed: true,
    savedScenarioId,
    session,
  };
}
