# Price Import Coverage Integrity Design

## Goal

Prevent a price CSV apply operation from leaving any active academic-offer
combination without an applicable base price.

## Confirmed release-gate root cause

PR #361 changed the valid import `@/lib/pricing-normalize` to the nonexistent
`@/lib/pricing-normalization`. GitHub Actions runs #864 and #865 therefore
failed first in TypeScript with `TS2307`. The fix restores the existing module
without changing CI or weakening checks.

## Effective-state model

The guard will mirror the current runtime semantics:

1. Read active `base_price` overrides from the published PRICES snapshot.
2. Read active live `AdminPriceOverride` rows.
3. Project the import over the live layer:
   - `replace` removes the current live `base_price` layer and replaces it with
     every prepared row, including `noop` rows because the real writer recreates
     them.
   - `update-only` preserves live rows, applies `update`, preserves `noop`, and
     rejects `create`.
4. Merge published and projected-live rows by ID, with live rows replacing a
   published row that has the same ID. This is the existing
   `listActivePublishedPriceOverrides` behavior.

Projection is pure: it does not publish snapshots, write rows, or call external
systems.

## Coverage evaluation

The existing `findPublishedBasePriceOverride` matcher remains the single source
of truth for line, modality, plan, tier, campus, program, module, and aliases.
Coverage inputs include all active offerings on active campuses. Unresolvable
line/modality and missing pricing-plan cases remain explicit blocking issues.
Issues are sorted deterministically before being returned.

## Transaction flow

`applyPreparedPricesImport` will build one canonical write representation per
prepared row and reuse it for both projection and persistence. Inside the
existing Prisma transaction, before `deleteMany`, `create`, or `update`, it will:

1. Load published/live price layers through the transaction client.
2. Load active coverage contexts through the same transaction client.
3. Project the effective state.
4. Run the coverage report and throw `PriceImportCoverageError` when issues
   remain.

Throwing aborts the transaction and prevents session application because
`markAdminImportSessionApplied` runs only after the importer returns.

## HTTP contract

The apply route will catch only `PriceImportCoverageError` and return:

- status `422`;
- `errorCode: PRICE_IMPORT_COVERAGE_INCOMPLETE`;
- deterministic structured details containing counts and safe issue fields.

Other errors retain their current responses. Coverage errors do not mark the
session applied and do not emit the success business event.

## Test strategy

Tests will cover projection actions and modes, published-only and live-only
coverage, campus/program aliases, unresolved contexts, transaction ordering and
no mutation on rejection, valid apply behavior, and the route-level 422
contract.

## Non-goals

- No Prisma schema or migration changes.
- No snapshot publication.
- No CI, Vercel, auth, endpoint-name, or frontend changes.
- No change to price-selection precedence beyond mirroring current behavior.
