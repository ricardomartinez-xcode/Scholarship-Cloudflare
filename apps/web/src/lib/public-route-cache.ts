import { AdminConfigModule } from "@prisma/client";
import { revalidateTag } from "next/cache";

import { logStructured } from "@/lib/observability";

export const PUBLIC_ROUTE_CACHE_REVALIDATE_SECONDS = 300;

export const PUBLIC_ROUTE_CACHE_TAGS = {
  campuses: "public:campuses",
  costos: "public:costos",
  directorio: "public:directorio",
  oferta: "public:oferta",
  planes: "public:planes",
} as const;

export function buildPublicRequestId(route: string) {
  const normalized = route.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "");
  return `${normalized}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

export function normalizePublicCacheKeyPart(value: string | null | undefined) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized || "__all__";
}

export function revalidatePublicRouteTags(tags: string[]) {
  for (const tag of new Set(tags)) {
    revalidateTag(tag, "max");
  }
}

export function getPublicRouteTagsForModule(module: AdminConfigModule) {
  switch (module) {
    case AdminConfigModule.DIRECTORY:
      return [PUBLIC_ROUTE_CACHE_TAGS.directorio];
    case AdminConfigModule.OFFER:
      return [PUBLIC_ROUTE_CACHE_TAGS.oferta];
    default:
      return [];
  }
}

export function logPublicRouteTiming(params: {
  route: string;
  requestId: string;
  startedAt: number;
  statusCode: number;
  actorUserId?: string | null;
  actorEmail?: string | null;
  metadata?: Record<string, unknown>;
}) {
  logStructured("info", "Public route handled", {
    module: "public-api",
    action: params.route,
    result:
      params.statusCode >= 500
        ? "error"
        : params.statusCode >= 400
          ? "rejected"
          : "success",
    requestId: params.requestId,
    actorUserId: params.actorUserId ?? null,
    actorEmail: params.actorEmail ?? null,
    metadata: {
      route: params.route,
      statusCode: params.statusCode,
      duration_ms: Date.now() - params.startedAt,
      ...(params.metadata ?? {}),
    },
  });
}
