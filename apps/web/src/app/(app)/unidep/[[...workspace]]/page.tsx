import { notFound, redirect } from "next/navigation";

import UnidepWorkspace from "@/components/unidep/UnidepWorkspace";
import { requireAuth } from "@/lib/authz";
import { getQuoteMode } from "@/lib/runtime-modes";
import {
  resolveWorkspaceRouteFromLegacy,
  resolveWorkspaceSectionFromSlug,
} from "@/lib/unidep-navigation";
import { loadUnidepWorkspaceData } from "@/lib/unidep-page-data";

export const dynamic = "force-dynamic";

function readQueryValue(
  value: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default async function UnidepPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspace?: string[] }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ workspace }, rawSearchParams] = await Promise.all([
    params,
    searchParams ?? Promise.resolve(undefined),
  ]);
  const sectionSlug = workspace?.[0];
  const legacyTab = readQueryValue(rawSearchParams?.tab);
  const legacySection = readQueryValue(rawSearchParams?.section);
  const newUser = readQueryValue(rawSearchParams?.newUser) === "1";

  if (!sectionSlug) {
    const legacyRoute = resolveWorkspaceRouteFromLegacy(legacyTab, legacySection);
    if (legacyRoute !== "/unidep") {
      redirect(legacyRoute);
    }
  }

  if (workspace && workspace.length > 1) {
    notFound();
  }

  const forcedSection = resolveWorkspaceSectionFromSlug(sectionSlug);
  if (!forcedSection) {
    notFound();
  }

  const user = await requireAuth();
  const workspaceData = await loadUnidepWorkspaceData(user.id, newUser, user.role);
  const quoteMode = getQuoteMode();

  return (
    <main>
      <UnidepWorkspace
        {...workspaceData}
        newUser={newUser}
        quoteMode={quoteMode}
        visibleOfferCycles={workspaceData.visibleOfferCycles}
        forcedSection={forcedSection}
      />
    </main>
  );
}
