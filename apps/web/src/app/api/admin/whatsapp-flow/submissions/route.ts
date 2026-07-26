import {NextResponse} from "next/server";import {prisma} from "@/lib/prisma";
export async function GET(){const items=await prisma.whatsappFlowSubmission.findMany({take:100,orderBy:{createdAt:"desc"},include:{scheduledActions:true,advisorTasks:true}});return NextResponse.json({items})}
