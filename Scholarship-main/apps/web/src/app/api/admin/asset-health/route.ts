import { NextResponse } from "next/server";

import { getAdminUser } from "@/lib/admin-session";
import { getProgramAssetHealthSummary, runProgramAssetHealthCheck } from "@/lib/asset-health";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function hasAssetHealthToken(request: Request) {
  const expected = process.env.ASSET_HEALTH_API_TOKEN;
  if (!expected) return false;
  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${expected}`;
}

async function authorize(request: Request) {
  const admin = await getAdminUser();
  if (admin) return admin;
  if (hasAssetHealthToken(request)) return { id: null, email: "asset-health-token" };
  return null;
}

export async function GET(request: Request) {
  const actor = await authorize(request);
  if (!actor) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }

  const summary = await getProgramAssetHealthSummary();
  return NextResponse.json({ ok: true, actor: actor.email, summary });
}

export async function POST(request: Request) {
  const actor = await authorize(request);
  if (!actor) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }

  const summary = await runProgramAssetHealthCheck();
  return NextResponse.json({ ok: true, actor: actor.email, summary });
}
