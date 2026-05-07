import { NextResponse } from "next/server";

import {
  assertMetaWebhookSignature,
  processMetaWebhook,
  verifyMetaWebhookHandshake,
} from "@/lib/meta-whatsapp";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  try {
    const challenge = verifyMetaWebhookHandshake({
      mode: searchParams.get("hub.mode"),
      verifyToken: searchParams.get("hub.verify_token"),
      challenge: searchParams.get("hub.challenge"),
    });

    return new NextResponse(challenge, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "meta_webhook_handshake_failed",
      },
      { status: 403 },
    );
  }
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");

  try {
    assertMetaWebhookSignature(rawBody, signature);
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "meta_webhook_signature_failed",
      },
      { status: 401 },
    );
  }

  try {
    const processed = await processMetaWebhook(rawBody);
    return NextResponse.json({ ok: true, processed });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "meta_webhook_processing_failed",
      },
      { status: 500 },
    );
  }
}
