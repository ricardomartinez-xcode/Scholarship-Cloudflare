# Import Workspace UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the approved central import workspace UI without changing data contracts.

**Architecture:** Reuse existing importers in destination modules and add navigation/deep-link affordances from `/admin/importaciones`. The import center remains server-rendered and the module clients read the current URL once on mount to select the right panel.

**Tech Stack:** Next.js App Router, React client components, Tailwind utility classes, existing admin UI components.

---

### Task 1: Import Center Content

**Files:**
- Modify: `apps/web/src/app/(admin)/admin/(protected)/importaciones/page.tsx`
- Modify: `apps/web/src/app/(admin)/admin/(protected)/importaciones/layout.tsx`

- [x] Rename the page copy from history-only to `Centro de importación`.
- [x] Add step cards for origin, destination, and validation.
- [x] Add destination cards with links to existing importers.
- [x] Keep metrics, filters, and history below the new workspace.

### Task 2: Module Deep Links

**Files:**
- Modify: `apps/web/src/components/admin/PricesClient.tsx`
- Modify: `apps/web/src/components/admin/BenefitsClient.tsx`
- Modify: `apps/web/src/components/admin/OfferImportClient.tsx`
- Modify: `apps/web/src/app/(admin)/admin/(protected)/unidep/fees/FeesClient.tsx`
- Modify: `apps/web/src/app/(admin)/admin/(protected)/unidep/campuses/CampusesClient.tsx`

- [x] Open `?panel=imports` on prices, benefits, and offer pages.
- [x] Open `?panel=base` for base scholarship imports.
- [x] Open `?tab=seed&seedMode=...` for fees import.
- [x] Add an import anchor to campuses.

### Task 3: R2 Handoff

**Files:**
- Modify: `apps/web/src/app/(admin)/admin/(protected)/files/FilesClient.tsx`

- [x] Add a compact handoff explaining when R2 is the file origin and where to continue the import.

### Task 4: Verification

- [x] Run `npm run lint`.
- [x] Run `npm run typecheck`.
- [x] Run `npm test`.
- [x] Run `npm run build`.
- [ ] Commit, push, and confirm the Vercel deployment is `READY`.
