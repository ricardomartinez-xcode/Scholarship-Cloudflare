import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AppRealPage() {
  // Ruta de compatibilidad. El panel canónico post-login vive en /unidep.
  // Puede eliminarse cuando se confirme que no existen referencias externas activas.
  // Ver docs/ROUTING_MODES_REFERENCE.md §1 y §4.
  redirect("/unidep");
}
