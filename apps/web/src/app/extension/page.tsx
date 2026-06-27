import { redirect } from "next/navigation";

import AppChrome from "@/components/app/AppChrome";
import UnidepWorkspace from "@/components/unidep/UnidepWorkspace";
import { auth } from "@/lib/auth/server";
import { getSessionUser } from "@/lib/authz";
import {
  clearCloudflareSessionCookieFromStore,
  signOutCloudflareSession,
} from "@/lib/cloudflare/auth";
import { isCloudflareRuntime } from "@/lib/cloudflare/runtime";
import { getQuoteMode } from "@/lib/runtime-modes";
import { loadUnidepWorkspaceData } from "@/lib/unidep-page-data";

export const dynamic = "force-dynamic";

function redirectToExtensionSignIn(message?: string) {
  if (!message) {
    redirect("/extension/auth/sign-in");
  }

  redirect(
    `/extension/auth/sign-in?error=${encodeURIComponent(message)}`,
  );
}

export default async function ExtensionPage({
  searchParams,
}: {
  searchParams?: Promise<{ newUser?: string }>;
}) {
  const params = searchParams ? await searchParams : undefined;
  const newUser = params?.newUser === "1";
  const session = await getSessionUser();

  if (session.status === "unauthenticated") {
    redirectToExtensionSignIn();
  }
  if (session.status === "forbidden") {
    redirectToExtensionSignIn(
      "Tu cuenta no tiene acceso a esta extensión. Usa el sitio oficial para solicitar acceso.",
    );
  }
  if (session.status === "inactive") {
    redirectToExtensionSignIn("Tu usuario está desactivado.");
  }

  const activeSession = session as Extract<typeof session, { status: "ok" }>;

  const workspaceData = await loadUnidepWorkspaceData(
    activeSession.user.id,
    newUser,
    activeSession.user.role,
  );
  const quoteMode = getQuoteMode();

  async function signOutAction() {
    "use server";
    if (isCloudflareRuntime()) {
      await signOutCloudflareSession();
      await clearCloudflareSessionCookieFromStore();
    } else {
      await auth.signOut();
    }
    redirect("/extension/auth/sign-in");
  }

  return (
    <AppChrome
      userEmail={activeSession.email}
      userDisplayName={activeSession.user.displayName?.trim() || null}
      isAdmin={false}
      profileHref={null}
      signOutAction={signOutAction}
    >
      <UnidepWorkspace
        {...workspaceData}
        newUser={newUser}
        quoteMode={quoteMode}
      />
    </AppChrome>
  );
}
