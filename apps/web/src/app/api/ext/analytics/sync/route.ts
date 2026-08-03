import { NextResponse } from "next/server";
import { z } from "zod";

import { syncExtensionAnalytics } from "@/lib/extension-analytics";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const uuidSchema = z.string().uuid();
const campaignSchema = z.object({
  id: uuidSchema,
  campaignName: z.string().min(1).max(180),
  status: z.string().max(40).optional().nullable(),
  messageTemplate: z.string().max(10_000).optional().nullable(),
  scheduleAt: z.string().optional().nullable(),
  startedAt: z.string().optional().nullable(),
  completedAt: z.string().optional().nullable(),
  batchSize: z.number().optional().nullable(),
  messageDelayMs: z.number().optional().nullable(),
  batchDelayMs: z.number().optional().nullable(),
  jitterMs: z.number().optional().nullable(),
  hasMedia: z.boolean().optional().nullable(),
  mediaType: z.string().max(120).optional().nullable(),
  totalCount: z.number().optional().nullable(),
  sentCount: z.number().optional().nullable(),
  failedCount: z.number().optional().nullable(),
  pendingCount: z.number().optional().nullable(),
  invalidCount: z.number().optional().nullable(),
  estimatedCostMxn: z.number().optional().nullable(),
  country: z.unknown().optional().nullable(),
  settings: z.unknown().optional().nullable(),
  meta: z.unknown().optional().nullable(),
  createdAt: z.string().optional().nullable(),
  updatedAt: z.string().optional().nullable(),
});
const recipientSchema = z.object({
  id: uuidSchema,
  campaignId: uuidSchema,
  contactValue: z.string().min(1).max(80),
  contactName: z.string().max(180).optional().nullable(),
  status: z.string().max(40).optional().nullable(),
  resolvedMessage: z.string().max(10_000).optional().nullable(),
  attemptedAt: z.string().optional().nullable(),
  sentAt: z.string().optional().nullable(),
  failedAt: z.string().optional().nullable(),
  lastError: z.string().max(1000).optional().nullable(),
  payload: z.unknown().optional().nullable(),
  createdAt: z.string().optional().nullable(),
  updatedAt: z.string().optional().nullable(),
});
const eventSchema = z.object({
  id: uuidSchema,
  campaignId: uuidSchema.optional().nullable(),
  recipientId: uuidSchema.optional().nullable(),
  eventType: z.string().min(1).max(80),
  occurredAt: z.string().optional().nullable(),
  payload: z.unknown().optional().nullable(),
});
const requestSchema = z.object({
  nameId: z.string().min(2).max(80).optional(),
  extensionVersion: z.string().max(40).optional().nullable(),
  clientMeta: z.unknown().optional().nullable(),
  campaigns: z.array(campaignSchema).max(20).optional(),
  recipients: z.array(recipientSchema).max(500).optional(),
  events: z.array(eventSchema).max(250).optional(),
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Recalc-Installation-Id, X-Recalc-Installation-Proof, X-Extension-Version",
  "Cache-Control": "no-store",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(request: Request) {
  const installationId = request.headers.get("x-recalc-installation-id")?.trim() ?? "";
  const installationProof = request.headers.get("x-recalc-installation-proof")?.trim() ?? "";
  if (!installationId || !installationProof) {
    return NextResponse.json(
      { ok: false, error: "Falta la identidad técnica de la instalación." },
      { status: 401, headers: corsHeaders },
    );
  }

  const limiter = await checkRateLimit(`ext-analytics-sync:${installationId}`, {
    limit: 120,
    windowMs: 60_000,
  });
  if (!limiter.ok) {
    return NextResponse.json(
      { ok: false, error: "rate_limited", retryAfterMs: limiter.retryAfterMs },
      { status: 429, headers: corsHeaders },
    );
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Carga analítica inválida.", details: parsed.error.flatten() },
      { status: 400, headers: corsHeaders },
    );
  }

  try {
    const sync = await syncExtensionAnalytics({
      installationId,
      installationProof,
      ...parsed.data,
      extensionVersion:
        parsed.data.extensionVersion ?? request.headers.get("x-extension-version") ?? null,
    });
    return NextResponse.json({ ok: true, sync }, { status: 200, headers: corsHeaders });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No fue posible sincronizar la analítica.";
    return NextResponse.json(
      { ok: false, error: message },
      { status: message.includes("no autorizada") ? 401 : 400, headers: corsHeaders },
    );
  }
}
