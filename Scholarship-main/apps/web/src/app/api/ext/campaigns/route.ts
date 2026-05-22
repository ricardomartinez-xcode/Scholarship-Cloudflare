import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/authz";
import {
  createExtensionCampaign,
  listExtensionCampaignsWithRunnerHealthForUser,
  parseCampaignRecipientText,
  type ExtensionCampaignChannel,
} from "@/lib/extension-automation";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

function statusCodeForSessionState(status: "unauthenticated" | "forbidden" | "inactive" | "ok") {
  if (status === "ok") return 200;
  if (status === "unauthenticated") return 401;
  return 403;
}

function toSafeDelayMs(value: unknown, maxMs: number) {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Math.max(0, Math.min(maxMs, Math.round(numeric)));
}

function buildCampaignMeta(
  meta: Record<string, unknown> | null | undefined,
  request: Request,
) {
  const base = meta && typeof meta === "object" ? { ...meta } : {};
  const metaRecord = base as Record<string, unknown>;
  const batchDelayMs = toSafeDelayMs(metaRecord.batchDelayMs, 30 * 60_000);
  const jitterMs = toSafeDelayMs(metaRecord.jitterMs, 60_000);

  return {
    ...base,
    ...(batchDelayMs !== null ? { batchDelayMs } : {}),
    ...(jitterMs !== null ? { jitterMs } : {}),
    extensionClient:
      request.headers.get("x-extension-client") ??
      String(metaRecord.extensionClient ?? "chrome-sidepanel"),
    extensionVersion:
      request.headers.get("x-extension-version") ??
      String(metaRecord.extensionVersion ?? "unknown"),
  };
}

export async function GET() {
  const session = await getSessionUser();
  if (session.status !== "ok") {
    return NextResponse.json(
      { ok: false, error: session.status },
      { status: statusCodeForSessionState(session.status) },
    );
  }

  const { campaigns, runner } = await listExtensionCampaignsWithRunnerHealthForUser(
    session.user.id,
  );
  return NextResponse.json({ ok: true, campaigns, runner });
}

export async function POST(request: Request) {
  const session = await getSessionUser();
  if (session.status !== "ok") {
    return NextResponse.json(
      { ok: false, error: session.status },
      { status: statusCodeForSessionState(session.status) },
    );
  }

  const limiter = checkRateLimit(`ext-campaign-create:${session.user.id}`, {
    limit: 30,
    windowMs: 60_000,
  });
  if (!limiter.ok) {
    return NextResponse.json(
      { ok: false, error: "rate_limited", retryAfterMs: limiter.retryAfterMs },
      { status: 429 },
    );
  }

  const body = (await request.json().catch(() => null)) as
    | {
        campaignName?: string;
        channel?: string | null;
        notes?: string;
        batchSize?: number;
        scheduleAt?: string | null;
        messageTemplate?: string | null;
        messageDelayMs?: number | null;
        mediaUrl?: string | null;
        recipientsText?: string | null;
        recipients?: Array<{
          contactValue?: string;
          contactName?: string | null;
          externalKey?: string | null;
          scheduledFor?: string | null;
          payload?: Record<string, unknown> | null;
        }>;
        meta?: Record<string, unknown> | null;
      }
    | null;

  try {
    const channelCandidate = String(body?.channel ?? "")
      .trim()
      .toLowerCase();
    const channel: ExtensionCampaignChannel | null =
      channelCandidate === "extension_runner" ||
      channelCandidate === "whatsapp_web" ||
      channelCandidate === "test_mode" ||
      channelCandidate === "manual_review"
        ? (channelCandidate as ExtensionCampaignChannel)
        : null;

    const campaign = await createExtensionCampaign({
      userId: session.user.id,
      campaignName: String(body?.campaignName ?? "").trim() || "Campaña extensión",
      channel,
      notes: body?.notes ?? null,
      batchSize: body?.batchSize ?? null,
      scheduleAt: body?.scheduleAt ?? null,
      messageTemplate: body?.messageTemplate ?? null,
      messageDelayMs: body?.messageDelayMs ?? null,
      mediaUrl: body?.mediaUrl ?? null,
      recipients: [
        ...(body?.recipients?.map((recipient) => ({
          contactValue: String(recipient.contactValue ?? ""),
          contactName: recipient.contactName ?? null,
          externalKey: recipient.externalKey ?? null,
          scheduledFor: recipient.scheduledFor ?? null,
          payload: recipient.payload ?? null,
        })) ?? []),
        ...parseCampaignRecipientText(String(body?.recipientsText ?? "")),
      ],
      meta: buildCampaignMeta(body?.meta, request),
    });

    return NextResponse.json({ ok: true, campaign }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "No se pudo crear la campaña de extensión.",
      },
      { status: 400 },
    );
  }
}
