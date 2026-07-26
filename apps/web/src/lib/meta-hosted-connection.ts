import { createCipheriv, createHash, randomBytes } from "node:crypto";

import { prisma } from "@/lib/prisma";
import { getMetaWhatsappConnectionSummary, syncMetaWhatsappAssets } from "@/lib/meta-whatsapp";

type TokenResponse = {
  access_token?: string;
  expires_in?: number;
};

function encryptAccessToken(value: string) {
  const secret = process.env.META_INTEGRATION_SECRET?.trim();
  if (!secret) throw new Error("META_INTEGRATION_SECRET is required to store Meta tokens securely.");
  const key = createHash("sha256").update(secret).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64url");
}

export async function connectMetaHostedSignup(params: {
  userId: string;
  code: string;
  redirectUri: string;
}) {
  const appId = process.env.META_APP_ID?.trim();
  const appSecret = process.env.META_APP_SECRET?.trim();
  const graphApiVersion = process.env.META_GRAPH_API_VERSION?.trim() || "v25.0";
  if (!appId || !appSecret) throw new Error("META_APP_ID and META_APP_SECRET are required.");

  const search = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    grant_type: "authorization_code",
    redirect_uri: params.redirectUri,
    code: params.code,
  });
  const response = await fetch(`https://graph.facebook.com/${graphApiVersion}/oauth/access_token?${search.toString()}`, {
    method: "GET",
    cache: "no-store",
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Meta token exchange failed (${response.status}): ${body.slice(0, 400)}`);
  }
  const payload = await response.json() as TokenResponse;
  const accessToken = String(payload.access_token ?? "").trim();
  if (!accessToken) throw new Error("Meta did not return an access token during Hosted Signup exchange.");

  const encrypted = encryptAccessToken(accessToken);
  const expiresIn = Number(payload.expires_in ?? 0) || null;
  await prisma.userMetaWhatsappConnection.upsert({
    where: { userId: params.userId },
    update: {
      encryptedMetaAccessToken: encrypted,
      encryptedSystemUserToken: encrypted,
      graphApiVersion,
      accessTokenExpiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000) : null,
      connectedAt: new Date(),
      status: "connected",
      lastSyncError: null,
    },
    create: {
      userId: params.userId,
      encryptedMetaAccessToken: encrypted,
      encryptedSystemUserToken: encrypted,
      graphApiVersion,
      accessTokenExpiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000) : null,
      connectedAt: new Date(),
      status: "connected",
    },
  });

  try {
    await syncMetaWhatsappAssets(params.userId);
  } catch (error) {
    await prisma.userMetaWhatsappConnection.update({
      where: { userId: params.userId },
      data: {
        status: "warning",
        lastSyncError: error instanceof Error ? error.message.slice(0, 500) : "post_exchange_sync_failed",
      },
    });
  }
  return getMetaWhatsappConnectionSummary(params.userId);
}
