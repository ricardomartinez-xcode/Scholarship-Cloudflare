# Import Workspace UI Design

## Goal

Make Admin > Importaciones the single operational entry point for document imports, without changing backend contracts or importer APIs.

## Current Problem

The import history, downloadable templates, R2 file management, and actual upload forms are split across different screens. Operators must know which module owns each importer, switch sections manually, and then open a secondary tab inside the destination module.

## Approved Direction

Use a central import workspace. The first screen should answer three questions in order:

1. Where is the file coming from: local upload or existing R2 asset.
2. What will it update: prices, benefits, scholarships, offer, campuses, fees, or materials.
3. What happens next: validate, preview, apply, then audit in history.

## Scope

- Keep existing import endpoints and module-specific upload components.
- Turn `/admin/importaciones` into a command center with direct actions to each existing importer.
- Keep the audit table on the same screen below the command center.
- Add deep-link support so module pages can open directly on their import panel.
- Clarify R2 as an origin/source screen, not the importer itself.

## Non-Goals

- No Prisma, API, auth, or migration changes.
- No new import formats.
- No replacement of existing preview/apply/rollback logic.

## UI Requirements

- Primary page title: `Centro de importación`.
- Show a compact step summary: preparar archivo, elegir destino, validar/aplicar.
- Show destination cards with direct links to the correct importer.
- Separate `Oferta académica` from `Oferta por planteles` in labels and copy.
- Keep `Historial de importaciones` visible on the same page.
- Add a small R2 handoff panel that explains: sync/list files in R2, then relate or import from the destination module.

## Validation

- Run lint, typecheck, tests, and build.
- If browser automation is unavailable, rely on local build plus targeted code review and report the browser limitation.
