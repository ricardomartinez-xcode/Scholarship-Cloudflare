# Architecture V2

La arquitectura V2 usa npm workspaces.

```txt
apps/web                 Next.js App Router
packages/ui              Design system y componentes base
packages/db              Prisma, schema, migrations y cliente
packages/auth            Permisos, guards y navegación protegida
packages/domain          Lógica de negocio por dominio
packages/realtime        Supabase realtime
packages/config          Marca, rutas, env y feature flags
```

No debe recrearse código de app en la raíz. Los directorios raíz `src`, `public`, `prisma`, `tests` y `data` son inválidos en V2.

## Aliases

- `@/*` → `apps/web/src/*`
- `@relead/ui/*` → `packages/ui/src/*`
- `@relead/db/*` → `packages/db/src/*`
- `@relead/auth/*` → `packages/auth/src/*`
- `@relead/domain/*` → `packages/domain/src/*`
- `@relead/realtime/*` → `packages/realtime/src/*`
- `@relead/config/*` → `packages/config/src/*`
