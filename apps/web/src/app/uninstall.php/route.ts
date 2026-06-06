import { NextRequest, NextResponse } from "next/server";

import { withCors } from "@/lib/premium-sender-legacy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const redirectTo = new URL("/", request.nextUrl.origin);
  redirectTo.searchParams.set("source", "premium-sender-uninstall");

  return NextResponse.redirect(redirectTo, withCors({ status: 302 }));
}
