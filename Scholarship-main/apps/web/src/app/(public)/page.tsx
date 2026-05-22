import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/authz";
import PublicHero from "@/components/public/PublicHero";
import PublicBenefits from "@/components/public/PublicBenefits";
import PublicCapacitacion from "@/components/public/PublicCapacitacion";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { status } = await getSessionUser();

  if (status === "forbidden") redirect("/auth/denied");
  if (status === "inactive") redirect("/auth/denied?reason=inactive");
  if (status === "ok") redirect("/unidep");

  return (
    <>
      <PublicHero />
      <PublicBenefits />
      <PublicCapacitacion />
    </>
  );
}
