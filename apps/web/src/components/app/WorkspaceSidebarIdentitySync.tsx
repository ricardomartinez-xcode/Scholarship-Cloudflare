"use client";

import { useEffect } from "react";

const FALLBACK_LABEL = "Usuario";

function normalizeAccountLabel(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed || trimmed.toLowerCase() === "n/a") return FALLBACK_LABEL;
  return trimmed;
}

export default function WorkspaceSidebarIdentitySync() {
  useEffect(() => {
    const syncIdentity = () => {
      const accountNode = document.querySelector<HTMLElement>(
        ".ui-workspace-header__email",
      );
      const accountLabel = normalizeAccountLabel(accountNode?.textContent);

      document
        .querySelectorAll<HTMLElement>(
          ".ui-shell-drawer .ui-sidebar-action-panel .ui-shell-brand__eyebrow",
        )
        .forEach((node) => {
          node.textContent = "Usuario";
          node.setAttribute("data-workspace-identity", "synced");
        });

      document
        .querySelectorAll<HTMLElement>(
          ".ui-shell-drawer .ui-sidebar-action-panel .ui-shell-brand__title",
        )
        .forEach((node) => {
          node.textContent = accountLabel;
          node.setAttribute("title", accountLabel);
          node.setAttribute("data-workspace-identity", "synced");
        });
    };

    syncIdentity();

    const observer = new MutationObserver(syncIdentity);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    window.addEventListener("workspace:sync-sidebar-identity", syncIdentity);

    return () => {
      observer.disconnect();
      window.removeEventListener("workspace:sync-sidebar-identity", syncIdentity);
    };
  }, []);

  return null;
}
