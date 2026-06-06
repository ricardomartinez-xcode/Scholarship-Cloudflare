import { NextResponse } from "next/server";

import { getRecalcPublicApiOpenApiSpec } from "@/lib/recalc-public-control-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return NextResponse.json(getRecalcPublicApiOpenApiSpec(new URL(request.url).origin));
}
