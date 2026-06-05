import { NextResponse } from "next/server";

import { normalizeOpenApiObjectSchemas } from "@/lib/openapi-schema-normalizer";
import {
  getRecalcPublicApiGptActionOpenApiSpec,
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

const OMITTED_OPERATION_IDS = new Set([
  "getRecalcSystemHealth",
  "getGitHubRepository",
  "getLatestGitHubCommit",
]);

type RecalcOpenApiPaths = RecalcPublicApiOpenApiSpec["paths"];

type RecalcPathItem = RecalcOpenApiPaths[string];

function countOpenApiActions(paths: RecalcOpenApiPaths): number {
  return Object.values(paths).reduce((total, pathItem) => {
    if (!pathItem || typeof pathItem !== "object") return total;
    return total + Object.keys(pathItem).filter((method) => OPENAPI_HTTP_METHODS.has(method)).length;
  }, 0);
}

function isOmittedOperation(operation: unknown): boolean {
  if (!operation || typeof operation !== "object") return false;
  const operationId = (operation as { operationId?: unknown }).operationId;
  return typeof operationId === "string" && OMITTED_OPERATION_IDS.has(operationId);
}

function hasOpenApiOperation(pathItem: RecalcPathItem): boolean {
  return Object.keys(pathItem).some((method) => OPENAPI_HTTP_METHODS.has(method));
}

function mergePathItems(current: RecalcPathItem | undefined, next: RecalcPathItem): RecalcPathItem {
  return {
    ...(current ?? {}),
    ...next,
  };
}

function mergeGptActionSpecs(origin: string): RecalcPublicApiOpenApiSpec | null {
  const coreSpec = getRecalcPublicApiGptActionOpenApiSpec(origin, "gpt-core");
  const opsSpec = getRecalcPublicApiGptActionOpenApiSpec(origin, "gpt-ops");

  if (!coreSpec || !opsSpec) return null;

  const paths = Object.entries(opsSpec.paths).reduce<RecalcOpenApiPaths>(
    (mergedPaths, [path, pathItem]) => {
      mergedPaths[path] = mergePathItems(mergedPaths[path], pathItem);
      return mergedPaths;
    },
    { ...coreSpec.paths },
  );

  return {
    ...coreSpec,
    info: {
      ...coreSpec.info,
      title: "Recalc Public Control API - GPT Actions Main",
      description:
        `${coreSpec.info.description} Schema consolidado para GPT Actions con maximo ${GPT_ACTION_SCHEMA_LIMIT} acciones.`,
    },
    paths,
  };
}

function omitLeastUsefulOperations(paths: RecalcOpenApiPaths): RecalcOpenApiPaths {
  return Object.entries(paths).reduce<RecalcOpenApiPaths>((filteredPaths, [path, pathItem]) => {
    const filteredPathItem = Object.entries(pathItem).reduce<RecalcPathItem>((nextPathItem, [method, operation]) => {
      if (OPENAPI_HTTP_METHODS.has(method) && isOmittedOperation(operation)) return nextPathItem;
      nextPathItem[method] = operation;
      return nextPathItem;
    }, {});

    if (hasOpenApiOperation(filteredPathItem)) filteredPaths[path] = filteredPathItem;
    return filteredPaths;
  }, {});
}

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const mergedSpec = mergeGptActionSpecs(origin);

  if (!mergedSpec) {
    return NextResponse.json(
      {
        error: "GPT_MAIN_SCHEMA_SOURCE_NOT_FOUND",
      },
      { status: 500 },
    );
  }

  const paths = omitLeastUsefulOperations(mergedSpec.paths);
  const actionCount = countOpenApiActions(paths);

  if (actionCount !== GPT_ACTION_SCHEMA_LIMIT) {
    return NextResponse.json(
      {
        error: "GPT_MAIN_SCHEMA_ACTION_COUNT_MISMATCH",
        actionCount,
        expectedActions: GPT_ACTION_SCHEMA_LIMIT,
        omittedOperationIds: Array.from(OMITTED_OPERATION_IDS),
      },
      { status: 500 },
    );
  }

  const spec = {
    ...mergedSpec,
    paths,
    "x-recalc-actionCount": actionCount,
    "x-recalc-omittedFromMainSchema": Array.from(OMITTED_OPERATION_IDS),
  };

  return NextResponse.json(normalizeOpenApiObjectSchemas(spec));
}
