import { createHmac, randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { getMetaLegalUrls } from "@/lib/meta-legal";

export const dynamic = "force-dynamic";

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4 || 4)) % 4);
  return Buffer.from(padded, "base64").toString("utf8");
}

function verifySignedRequest(signedRequest: string) {
  const [encodedSignature, encodedPayload] = signedRequest.split(".", 2);
  if (!encodedSignature || !encodedPayload) {
    throw new Error("Invalid signed_request payload.");
  }

  const appSecret = process.env.META_APP_SECRET?.trim();
  if (!appSecret) {
    throw new Error("META_APP_SECRET is required to verify signed_request.");
  }

  const expected = createHmac("sha256", appSecret).update(encodedPayload).digest("base64url");
  if (expected !== encodedSignature) {
    throw new Error("signed_request signature mismatch.");
  }

  return JSON.parse(decodeBase64Url(encodedPayload)) as Record<string, unknown>;
}

export async function GET() {
  const urls = getMetaLegalUrls();
  return NextResponse.json({
    ok: true,
    requestUrl: urls.dataDeletionRequestUrl,
    callbackUrl: urls.dataDeletionCallbackUrl,
  });
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  let signedRequest = "";

  if (contentType.includes("application/x-www-form-urlencoded")) {
    const rawBody = await request.text();
    const params = new URLSearchParams(rawBody);
    signedRequest = String(params.get("signed_request") ?? "").trim();
  } else {
    const payload = (await request.json().catch(() => null)) as { signed_request?: string } | null;
    signedRequest = String(payload?.signed_request ?? "").trim();
  }

  if (!signedRequest) {
    return NextResponse.json({ ok: false, error: "missing_signed_request" }, { status: 400 });
  }

  try {
    const parsed = verifySignedRequest(signedRequest);
    const confirmationCode = randomUUID();
    const urls = getMetaLegalUrls();
    const responseUrl = new URL(urls.dataDeletionRequestUrl);
    responseUrl.searchParams.set("code", confirmationCode);
    responseUrl.searchParams.set("source", "meta_callback");
    if (parsed.user_id != null) {
      responseUrl.searchParams.set("user_id", String(parsed.user_id));
    }

    return NextResponse.json({
      url: responseUrl.toString(),
      confirmation_code: confirmationCode,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "meta_data_deletion_failed",
      },
      { status: 400 },
    );
  }
}
