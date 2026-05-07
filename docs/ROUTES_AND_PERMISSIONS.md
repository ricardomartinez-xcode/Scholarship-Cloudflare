# Routes and Permissions (V2 Functional Modules)

## Estado de rama
- Rama de trabajo: `rebuild/v2-functional-modules`.
- No se detectó remoto `origin` ni rama remota `main`; se creó referencia local `main` desde el estado actual para aislar cambios.

## Sistema actual auditado

### Capacidades canónicas
- Fuente principal: `AdminCapability` (`@prisma/client`) y utilitarios en `src/lib/admin-capabilities.ts`.
- Sesión/admin guard: `src/lib/admin-session.ts`.
- API guard: `src/lib/api-auth.ts`.

### Matriz de rutas protegidas
- Dashboard admin protegido: `src/app/(admin)/admin/(protected)/**`.
- API admin protegidas por capability:
  - `src/app/api/admin/prices/import/route.ts`
  - `src/app/api/admin/sync-report/route.ts`
  - `src/app/api/admin/invites/route.ts`

### Centralización nueva (esta rama)
- `src/server/auth/permissions/capabilities.ts`
- `src/server/auth/permissions/route-capabilities.ts`
- `src/server/auth/permissions/admin-navigation.ts`
- `src/server/auth/permissions/guards.ts`
- `src/server/auth/permissions/client.ts`
- `src/server/auth/permissions/server.ts`

## Regla crítica aplicada
Las acciones sensibles siguen validando permisos en backend (no sólo UI), usando `requireAdminApiCapability` y/o `requireAdminCapability`.
