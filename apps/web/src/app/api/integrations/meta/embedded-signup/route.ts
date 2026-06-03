import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      ok: false,
      disabled: true,
      code: "meta_embedded_signup_temporarily_disabled",
      message: "Meta Embedded Signup esta deshabilitado temporalmente.",
    },
    { status: 503 },
  );
}

export async function POST() {
  return GET();
}
