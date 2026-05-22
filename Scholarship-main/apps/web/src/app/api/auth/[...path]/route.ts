import { auth } from "@/lib/auth/server";

type AuthRouteContext = {
  params: Promise<{ path: string[] }>;
};

export async function GET(request: Request, context: AuthRouteContext) {
  return auth.handler().GET(request, context);
}

export async function POST(request: Request, context: AuthRouteContext) {
  return auth.handler().POST(request, context);
}
