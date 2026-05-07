import { AdminCapability } from "@prisma/client";

import WabaEmbeddedSignupSection from "@/components/unidep/WabaEmbeddedSignupSection";
import { requireAdminCapabilityUser } from "@/lib/admin-session";

export const dynamic = "force-dynamic";

export default async function AdminWhatsappPage() {
  await requireAdminCapabilityUser(AdminCapability.manage_ctas);

  return (
    <div className="grid gap-6">
      <section className="ui-card ui-card-pad grid gap-2">
        <div className="text-xs uppercase tracking-[0.24em] text-slate-400">
          WhatsApp
        </div>
        <h1 className="text-lg font-semibold text-slate-100">
          Consola técnica del canal
        </h1>
      </section>

      <WabaEmbeddedSignupSection surface="admin" />
    </div>
  );
}
