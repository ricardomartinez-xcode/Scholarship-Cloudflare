import { NextResponse } from "next/server";

import { normalizeOpenApiObjectSchemas } from "@/lib/openapi-schema-normalizer";
import { getRecalcPublicApiGptActionOpenApiSpec } from "@/lib/recalc-public-control-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const spec = getRecalcPublicApiGptActionOpenApiSpec(new URL(request.url).origin, "gpt-core");

  return NextResponse.json(normalizeOpenApiObjectSchemas(spec));
}
