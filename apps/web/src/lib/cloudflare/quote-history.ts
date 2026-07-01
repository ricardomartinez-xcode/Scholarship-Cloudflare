import { d1All } from "@/lib/cloudflare/d1";

type D1QuoteSessionRow = {
  public_id: string;
  created_at: string;
  updated_at: string;
  latest_label: string | null;
  latest_total_mxn: number | null;
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
