import { NextResponse } from "next/server";

import { getAdminAccessState } from "@/lib/admin-session";
import { d1All, d1First } from "@/lib/cloudflare/d1";
import { isCloudflareRuntime } from "@/lib/cloudflare/runtime";
import { REQUIRED_D1_TABLES } from "@/lib/d1/preflight";

export const dynamic = "force-dynamic";

export async function GET() {
  const access = await getAdminAccessState();
  if (access.status !== "ok" || !access.user.capabilities.includes("view_admin_operations")) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }
  if (!isCloudflareRuntime()) {
    return NextResponse.json({ ok: false, error: "cloudflare_runtime_required" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  try {
    const ping = await d1First<{ ok: number }>("SELECT 1 AS ok");
    const placeholders = REQUIRED_D1_TABLES.map(() => "?").join(", ");
    const rows = await d1All<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name IN (${placeholders})`,
      [...REQUIRED_D1_TABLES],
    );
    const present = new Set(rows.map((row) => row.name));
    const missingTables = REQUIRED_D1_TABLES.filter((name) => !present.has(name));
    return NextResponse.json({
      ok: ping?.ok === 1 && missingTables.length === 0,
      checkedAt: new Date().toISOString(),
      missingTables,
      presentTables: REQUIRED_D1_TABLES.filter((name) => present.has(name)),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("D1 diagnostics failed", error);
    return NextResponse.json({ ok: false, error: "d1_unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
