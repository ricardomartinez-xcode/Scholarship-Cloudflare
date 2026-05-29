"use client";

/**
 * Deprecated shim retained temporarily to avoid breaking stale imports during the UI refactor.
 *
 * The workspace drawer identity is now rendered structurally by `AppChrome` through the
 * `accountLabel` prop. This component intentionally does nothing and can be deleted once
 * all historical imports are removed.
 */
export default function WorkspaceSidebarIdentitySync() {
  return null;
}
