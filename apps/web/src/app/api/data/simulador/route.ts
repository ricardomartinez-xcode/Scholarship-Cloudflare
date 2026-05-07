import {
  GET as getQuoteHistory,
  POST as postQuoteHistory,
} from "@/app/api/data/quote-history/route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  return getQuoteHistory(request);
}

export async function POST(request: Request) {
  return postQuoteHistory(request);
}
