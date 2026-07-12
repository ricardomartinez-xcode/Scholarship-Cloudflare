import { NextResponse } from "next/server";

import { getSmtpStatus } from "@/lib/smtp";

export const dynamic = "force-dynamic";

export async function GET() {
  const smtp = getSmtpStatus();
  return NextResponse.json({
    ok: true,
    mode: "legacy_invitation_neon_auth_only",
    oauthProviderConfigEnabled: false,
    webhookForwardingEnabled: false,
    externalIntegrationsEnabled: false,
    invitationFlowEnabled: true,
    neonAuthAccountCreationEnabled: true,
    smtpDeliveryConfigured: smtp.ok,
    missingSmtp: smtp.ok ? [] : smtp.missing,
  });
}
