import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      disabled: true,
      code: "meta_conversions_temporarily_disabled",
      message: "Meta Conversions API esta deshabilitado temporalmente.",
    },
    { status: 503 },
  );
}

export async function GET() {
  return POST();
}
