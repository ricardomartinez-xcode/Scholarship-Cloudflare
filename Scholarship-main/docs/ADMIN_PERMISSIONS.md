# Admin Permissions — Reference Document

This document describes the permission enforcement model for the admin panel,
including the capability-to-module matrix, known alias/naming issues, and the
functional domain grouping used in the navigation.

---

## 1. Enforcement Matrix

The canonical source of truth is:

```
src/lib/admin-permission-matrix.ts
```

That file exports two objects:

| Export | Purpose |
|---|---|
| `ADMIN_PERMISSION_MATRIX` | Maps each `AdminCapability` → module name, protected routes, UI actions, and server mutations |
| `ADMIN_ROUTE_GUARDS` | Maps each admin route prefix → `{ requiredAll?, requiredAny? }` |

### How to use it

**Checking what a capability controls:**

```ts
import { ADMIN_PERMISSION_MATRIX } from "@/lib/admin-permission-matrix";
import { AdminCapability } from "@prisma/client";

const entry = ADMIN_PERMISSION_MATRIX[AdminCapability.manage_benefits];
// entry.routes    → ["/admin/benefits"]
// entry.uiActions → ["create_benefit", ...]
// entry.mutations → ["upsertAdminBenefit", ...]
```

**Checking what guard a route requires:**

```ts
import { ADMIN_ROUTE_GUARDS } from "@/lib/admin-permission-matrix";

const guard = ADMIN_ROUTE_GUARDS["/admin/audit"];
// guard.requiredAll → [AdminCapability.view_admin_operations]
// guard.requiredAny → [AdminCapability.view_reports]
```

### Capability summary

| Capability | Module | Routes |
|---|---|---|
| `view_admin` | Panel de administración | `/admin` |
| `manage_benefits` | Beneficios adicionales | `/admin/benefits` |
| `manage_prices` | Precios y costos académicos | `/admin/prices`, `/admin/unidep/fees` |
| `manage_ctas` | CTAs, comunicados y templates | `/admin/ctas`, `/admin/comunicados`, `/admin/whatsapp-templates` |
| `manage_sidebar` | Mensajes de sidebar | `/admin/sidebar` |
| `manage_offers` | Oferta académica | `/admin/oferta`, `/admin/unidep/programs` |
| `manage_directory` | Directorio y planteles | `/admin/unidep/directory`, `/admin/unidep/campuses` |
| `view_users` | Consultar usuarios | `/admin/users` |
| `manage_users` | Gestionar usuarios | `/admin/users` |
| `view_invites` | Consultar invitaciones | `/admin/invitations` |
| `manage_invites` | Gestionar invitaciones | `/admin/invitations` |
| `view_org_members` | Consultar organizaciones | `/admin/organizations` |
| `manage_org_members` | Gestionar organizaciones | `/admin/organizations` |
| `view_reports` | Reportes y auditoría | `/admin/reporting`, `/admin/audit` |
| `view_admin_operations` | Operaciones avanzadas (submenu) | multiple (see matrix) |
| `publish_config` | Publicar configuración | (action only, no dedicated route) |

---

## 2. Capability Alias / Naming Cleanup

Two `UserCapability` enum values have **known typos** in the Prisma schema.
They cannot be renamed without a dedicated migration.

| Stored DB value | Intended correct name | Alias exported |
|---|---|---|
| `manage_comunications` | `manage_communications` | ✅ via `NORMALIZED_USER_CAPABILITY_ALIASES` |
| `owner_permitions` | `owner_permissions` | ✅ via `NORMALIZED_USER_CAPABILITY_ALIASES` |

### How aliases work

`src/lib/user-capabilities.ts` exports:

```ts
// Alias map: correct name → actual DB value
export const NORMALIZED_USER_CAPABILITY_ALIASES: Record<string, UserCapability>;

// Normalize any incoming string (correct OR typo) to the DB enum value
export function normalizeUserCapability(value: string): UserCapability;

// isUserCapability now accepts both the typo and the correct spelling
export function isUserCapability(value: string): value is UserCapability;
```

### Renaming plan

When the database migration window allows:

1. Add a new Prisma migration that renames:
   - `manage_comunications` → `manage_communications`
   - `owner_permitions` → `owner_permissions`
2. Update all references to use the new names.
3. Remove the entries from `NORMALIZED_USER_CAPABILITY_ALIASES`.
4. Update this document.

---

## 3. Admin Navigation Domains

The admin panel navigation is grouped into five functional domains, defined
in `src/components/admin/AdminChrome.tsx`:

### Operación
> Day-to-day operational modules.

| Nav label | Route | Required capability |
|---|---|---|
| Beneficios | `/admin/benefits` | `manage_benefits` |
| Precios | `/admin/prices` | `manage_prices` |
| Oferta académica | `/admin/oferta` | `manage_offers` |
| Invitaciones | `/admin/invitations` | `view_invites` OR `manage_invites` |

### Contenido
> Configurable content: banners, CTAs, announcements, templates.

| Nav label | Route | Required capability |
|---|---|---|
| Comunicados | `/admin/comunicados` | `view_admin_operations` + `manage_ctas` |
| Templates WhatsApp | `/admin/whatsapp-templates` | `view_admin_operations` + `manage_ctas` |
| CTA's | `/admin/ctas` | `view_admin_operations` + `manage_ctas` |
| Sidebar | `/admin/sidebar` | `manage_sidebar` |

### Usuarios y acceso
> User management, capability grants, and organization memberships.

| Nav label | Route | Required capability |
|---|---|---|
| Usuarios | `/admin/users` | `view_users` OR `manage_users` |
| Organizaciones | `/admin/organizations` | `view_admin_operations` + (`view_org_members` OR `manage_org_members`) |

### UNIDEP
> Institutional modules specific to UNIDEP.

| Nav label | Route | Required capability |
|---|---|---|
| Costos Académicos | `/admin/unidep/fees` | `manage_prices` |
| Directorio | `/admin/unidep/directory` | `manage_directory` |
| Programas académicos | `/admin/unidep/programs` | `manage_offers` |
| Plantel (Dirección) | `/admin/unidep/campuses` | `manage_directory` |

### Desarrollo
> Technical diagnostics, traceability tooling.  Not intended for daily use.

| Nav label | Route | Required capability |
|---|---|---|
| Reporte Operativo | `/admin/reporting` | `view_admin_operations` + `view_reports` |
| Auditoría | `/admin/audit` | `view_admin_operations` + `view_reports` |

---

## 4. UI ↔ Route Guard Alignment

Every navigation entry visible to a user is gated by the same capability check
enforced at the page level (`requireAdminCapabilityUser`).  This means:

- A user who **cannot** access a module will **not see** its navigation entry.
- A user who **can see** a navigation entry will still be blocked by the
  page-level guard if their session expires or capabilities change.

Known gap (resolved in this PR):

> `/admin/prices` previously called `getAdminUser()` without a capability
> check, meaning any admin-panel user could access it.  It now calls
> `requireAdminCapabilityUser(AdminCapability.manage_prices)`.

---

## 5. Keeping the Matrix in Sync

When adding a new admin route:

1. Add a `requireAdminCapabilityUser(...)` call to the new page.
2. Add an entry to `ADMIN_PERMISSION_MATRIX` in `admin-permission-matrix.ts`.
3. Add an entry to `ADMIN_ROUTE_GUARDS` in the same file.
4. Add the nav item to the appropriate domain array in `AdminChrome.tsx`.
5. Update this document.
