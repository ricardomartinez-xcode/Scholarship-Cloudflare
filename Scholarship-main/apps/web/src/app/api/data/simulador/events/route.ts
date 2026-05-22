import { POST as postQuoteHistoryEvent } from "@/app/api/data/quote-history/events/route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  return postQuoteHistoryEvent(request);
}
