import { NextResponse } from "next/server";
import { headers } from "next/headers";

import { auth } from "@/lib/auth/server";
import {
  clearCloudflareSessionCookie,
  signOutCloudflareSession,
} from "@/lib/cloudflare/auth";
import { isCloudflareRuntime } from "@/lib/cloudflare/runtime";
import {
  EXTENSION_SESSION_TOKEN_HEADER,
  revokeExtensionAuthSession,
} from "@/lib/extension-auth";
import {
  isIssuedExtensionToken,
  revokeIssuedExtensionSessionToken,
} from "@/lib/extension-session-tokens";

export const dynamic = "force-dynamic";

function readBearerToken(authorization: string | null) {
  const normalized = authorization?.trim() ?? "";
  if (!normalized.toLowerCase().startsWith("bearer ")) return "";
  return normalized.slice(7).trim();
}

export async function POST() {
  let revoked = false;

  try {
    const requestHeaders = await headers();
    const extensionSessionToken =
      requestHeaders.get(EXTENSION_SESSION_TOKEN_HEADER)?.trim() ||
      readBearerToken(requestHeaders.get("authorization"));

    if (extensionSessionToken) {
      revoked = isIssuedExtensionToken(extensionSessionToken)
        ? await revokeIssuedExtensionSessionToken(extensionSessionToken)
        : await revokeExtensionAuthSession(extensionSessionToken);
    }
  } catch {
    // Fall back to standard cookie-based sign out.
  }

  try {
    if (isCloudflareRuntime()) {
      await signOutCloudflareSession();
    } else {
      await auth.signOut();
    }
    revoked = true;
  } catch {
    // Ignore cookie sign-out failures when the extension token was already revoked.
  }

  const response = NextResponse.json({ ok: revoked });
  if (isCloudflareRuntime()) {
    clearCloudflareSessionCookie(response);
  }
  return response;
}
