import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/authz";
import { loadCanonicalFlatRulesPayload } from "@/lib/canonical-pricing-readers";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await getSessionUser();
  if (auth.status === "unauthenticated") {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  if (auth.status === "forbidden") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (auth.status === "inactive") {
    return NextResponse.json({ error: "inactive" }, { status: 403 });
  }

  try {
    const canonical = await loadCanonicalFlatRulesPayload();
    return NextResponse.json(canonical);
  } catch {
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }
}
