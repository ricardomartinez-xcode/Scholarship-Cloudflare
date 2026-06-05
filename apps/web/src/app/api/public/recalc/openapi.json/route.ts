import { NextResponse } from "next/server";

import { normalizeOpenApiObjectSchemas } from "@/lib/openapi-schema-normalizer";
import { getRecalcPublicApiOpenApiSpec } from "@/lib/recalc-public-control-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const spec = getRecalcPublicApiOpenApiSpec(new URL(request.url).origin);

  return NextResponse.json(normalizeOpenApiObjectSchemas(spec));
}
