import { AdminCapability } from "@prisma/client";
import EmbeddedSignupConnector from "@/components/meta/EmbeddedSignupConnector";
import { requireAdminCapabilityUser } from "@/lib/admin-session";
export const dynamic="force-dynamic";
export default async function Page(){await requireAdminCapabilityUser(AdminCapability.manage_ctas);return <EmbeddedSignupConnector />;}
