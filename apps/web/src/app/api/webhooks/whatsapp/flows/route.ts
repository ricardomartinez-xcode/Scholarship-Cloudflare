import { NextResponse } from "next/server";
import { decryptFlowRequest, encryptFlowResponse, FlowEndpointError, responseFor, type EncryptedFlowRequest } from "@/lib/whatsapp-flow/flow-endpoint";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  let body: EncryptedFlowRequest;
  try { body = await request.json() as EncryptedFlowRequest; }
  catch { return new NextResponse(null, { status: 400 }); }
  try {
    const decrypted = decryptFlowRequest(body);
    const encrypted = encryptFlowResponse(responseFor(decrypted.request), decrypted.aesKey, decrypted.iv);
    return new NextResponse(encrypted, { status: 200, headers: { "Content-Type": "text/plain" } });
  } catch (error) {
    const status = error instanceof FlowEndpointError ? error.status : 500;
    return new NextResponse(null, { status });
  }
}
