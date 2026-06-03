import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      disabled: true,
      code: "meta_data_deletion_temporarily_disabled",
      message: "El endpoint de Meta Data Deletion esta deshabilitado temporalmente.",
    },
    { status: 503 },
  );
}

export async function GET() {
  return POST();
}
