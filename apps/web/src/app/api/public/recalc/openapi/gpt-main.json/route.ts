import { NextResponse } from "next/server";

import { normalizeOpenApiObjectSchemas } from "@/lib/openapi-schema-normalizer";
import {
  getRecalcPublicApiOpenApiSpec,
  type RecalcPublicApiOpenApiSpec,
} from "@/lib/recalc-public-control-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GPT_ACTION_SCHEMA_LIMIT = 30;

const OPENAPI_HTTP_METHODS = new Set([
  "get",
  "put",
  "post",
  "delete",
  "patch",
  "options",
  "head",
  "trace",
]);

const GPT_MAIN_PATHS = [
  "/api/public/recalc/status",
  "/api/public/recalc/config",
  "/api/public/recalc/audit-log",
  "/api/public/recalc/offers",
  "/api/public/recalc/offers/{id}/status",
  "/api/public/recalc/importers/academic-offer/validate",
  "/api/public/recalc/importers/academic-offer",
  "/api/public/recalc/importers/prices",
  "/api/public/recalc/prices/overrides",
  "/api/public/recalc/prices/overrides/{id}",
  "/api/public/recalc/importers/prices/{sessionId}/apply",
  "/api/public/recalc/importers/prices/{sessionId}/rollback",
  "/api/public/recalc/importers/benefits",
  "/api/public/recalc/importers/benefits/{sessionId}/apply",
  "/api/public/recalc/importers/benefits/{sessionId}/rollback",
  "/api/public/recalc/importers/base-scholarships",
  "/api/public/recalc/benefits/base-scholarships",
  "/api/public/recalc/benefits/base-scholarships/{id}",
  "/api/public/recalc/importers/base-scholarships/{sessionId}/apply",
  "/api/public/recalc/importers/base-scholarships/{sessionId}/rollback",
  "/api/public/recalc/quotes/diagnose",
  "/api/public/recalc/quotes/simulate",
  "/api/public/recalc/system/env-check",
  "/api/public/recalc/system/importer-status",
  "/api/public/recalc/system/quote-engine-status",
  "/api/public/recalc/github/pulls",
  "/api/public/recalc/github/actions/runs",
  "/api/public/recalc/github/actions/dispatch",
  "/api/public/recalc/github/commits/latest",
  "/api/public/recalc/github/issues",
] as const;

type RecalcOpenApiPaths = RecalcPublicApiOpenApiSpec["paths"];

function filterOpenApiPaths(paths: RecalcOpenApiPaths): RecalcOpenApiPaths {
  return GPT_MAIN_PATHS.reduce<RecalcOpenApiPaths>((filtered, path) => {
    const pathItem = paths[path];
    if (pathItem) filtered[path] = pathItem;
    return filtered;
  }, {});
}

function countOpenApiActions(paths: RecalcOpenApiPaths): number {
  return Object.values(paths).reduce((total, pathItem) => {
    if (!pathItem || typeof pathItem !== "object") return total;
    return total + Object.keys(pathItem).filter((method) => OPENAPI_HTTP_METHODS.has(method)).length;
  }, 0);
}

export async function GET(request: Request) {
  const fullSpec = getRecalcPublicApiOpenApiSpec(new URL(request.url).origin);
  const paths = filterOpenApiPaths(fullSpec.paths);
  const actionCount = countOpenApiActions(paths);

  if (actionCount > GPT_ACTION_SCHEMA_LIMIT) {
    return NextResponse.json(
      {
        error: "GPT_ACTION_SCHEMA_LIMIT_EXCEEDED",
        actionCount,
        maxActions: GPT_ACTION_SCHEMA_LIMIT,
      },
      { status: 500 },
    );
  }

  const spec = {
    ...fullSpec,
    info: {
      ...fullSpec.info,
      title: `${fullSpec.info.title} - GPT Actions Main`,
      description:
        `${fullSpec.info.description} Schema consolidado para GPT Actions con maximo ${GPT_ACTION_SCHEMA_LIMIT} acciones.`,
    },
    paths,
    "x-recalc-actionCount": actionCount,
    "x-recalc-omittedFromMainSchema": [
      "/api/public/recalc/system/health",
      "/api/public/recalc/github/repository",
    ],
  };

  return NextResponse.json(normalizeOpenApiObjectSchemas(spec));
}
