import { AdminCapability } from "@prisma/client";
import WabaEmbeddedSignupSection from "@/components/unidep/WabaEmbeddedSignupSection";
import { requireAdminCapabilityUser } from "@/lib/admin-session";
export const dynamic="force-dynamic";
export default async function Page(){await requireAdminCapabilityUser(AdminCapability.manage_ctas);return <WabaEmbeddedSignupSection surface="admin" cloudOnly />;}
