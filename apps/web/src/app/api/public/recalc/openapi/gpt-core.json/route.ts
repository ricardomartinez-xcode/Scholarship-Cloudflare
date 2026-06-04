import { NextResponse } from "next/server";

import { getRecalcPublicApiGptActionOpenApiSpec } from "@/lib/recalc-public-control-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return NextResponse.json(
    getRecalcPublicApiGptActionOpenApiSpec(new URL(request.url).origin, "gpt-core"),
  );
}
