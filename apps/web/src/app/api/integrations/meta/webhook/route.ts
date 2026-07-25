import { NextResponse } from "next/server";
import { assertMetaWebhookSignature,processMetaWebhook,verifyMetaWebhookHandshake } from "@/lib/meta-whatsapp";
export const dynamic="force-dynamic";
export async function GET(request:Request){const q=new URL(request.url).searchParams;try{return new NextResponse(verifyMetaWebhookHandshake({mode:q.get("hub.mode"),verifyToken:q.get("hub.verify_token"),challenge:q.get("hub.challenge")}),{headers:{"Content-Type":"text/plain"}});}catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:"webhook_verification_failed"},{status:403});}}
export async function POST(request:Request){const rawBody=await request.text();try{assertMetaWebhookSignature(rawBody,request.headers.get("x-hub-signature-256"));return NextResponse.json({ok:true,processed:await processMetaWebhook(rawBody)});}catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:"meta_webhook_failed"},{status:401});}}
