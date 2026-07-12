import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function disabled() {
  return NextResponse.json(
    {
      ok: false,
      disabled: true,
      code: "meta_integrations_temporarily_disabled",
      message:
        "Las integraciones nuevas de Meta/WhatsApp estan deshabilitadas temporalmente durante la migracion a Supabase Auth.",
    },
    { status: 503 },
  );
}

export async function GET() {
  return disabled();
}

export async function POST() {
  return disabled();
}

export async function DELETE() {
  return disabled();
}
