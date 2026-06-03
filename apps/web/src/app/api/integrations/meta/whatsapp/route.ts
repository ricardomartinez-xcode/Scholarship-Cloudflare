import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      ok: false,
      disabled: true,
      code: "whatsapp_integration_temporarily_disabled",
      message: "La integracion WhatsApp/Meta esta deshabilitada temporalmente.",
    },
    { status: 503 },
  );
}

export async function POST() {
  return GET();
}

export async function DELETE() {
  return GET();
}
