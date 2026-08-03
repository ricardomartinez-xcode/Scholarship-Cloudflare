import { NextResponse } from "next/server";
import { z } from "zod";

import { registerExtensionAnalyticsInstallation } from "@/lib/extension-analytics";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const requestSchema = z.object({
  installationId: z.string().min(12).max(96),
  installationProof: z.string().min(32).max(256),
  nameId: z.string().min(2).max(80),
  extensionVersion: z.string().max(40).optional().nullable(),
  clientMeta: z.unknown().optional().nullable(),
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Recalc-Installation-Id, X-Recalc-Installation-Proof, X-Extension-Version",
  "Cache-Control": "no-store",
};

function requestFingerprint(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "unknown";
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(request: Request) {
  const limiter = await checkRateLimit(`ext-analytics-register:${requestFingerprint(request)}`, {
    limit: 20,
    windowMs: 10 * 60_000,
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
      { ok: false, error: "Datos de instalación inválidos.", details: parsed.error.flatten() },
      { status: 400, headers: corsHeaders },
    );
  }

  try {
    const installation = await registerExtensionAnalyticsInstallation(parsed.data);
    return NextResponse.json(
      { ok: true, installation },
      { status: 200, headers: corsHeaders },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "No fue posible registrar la instalación.";
    return NextResponse.json(
      { ok: false, error: message },
      { status: message.includes("otra prueba") ? 409 : 400, headers: corsHeaders },
    );
  }
}
