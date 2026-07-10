# Migracion de base de datos a Supabase PostgreSQL

## Estado

- Rama: `migration/vercel-supabase`
- Fuente de verdad propuesta: `supabase/migrations`
- Migracion principal: `supabase/migrations/20260710204000_recalc_admin_core.sql`
- Estado remoto: no ejecutado. No se aplicaron migraciones en Supabase remoto.
- Entorno permitido para ejecucion: Supabase staging.

La aplicacion anterior conserva dependencias de Cloudflare D1, Neon y Prisma. Para la ruta Vercel/Supabase se define un esquema PostgreSQL versionado en `recalc_admin`, protegido con RLS y preparado para Supabase Auth, Realtime y Storage.

## Fuente de verdad

`supabase/migrations` queda como fuente de verdad SQL para la migracion. Prisma permanece temporalmente en el repositorio como deuda heredada mientras se termina la migracion de accesos de datos, pero no debe generar migraciones nuevas para las tablas Supabase de `recalc_admin`.

La configuracion local de Supabase expone `recalc_admin` en `supabase/config.toml` para permitir PostgREST/Supabase JS con RLS. Cualquier proyecto staging hospedado debe replicar esa exposicion de esquema antes de ejecutar scripts que usen `.schema("recalc_admin")`.

## Inventario objetivo

| Area | Tabla PostgreSQL | Responsabilidad |
| --- | --- | --- |
| Identidad de dominio | `recalc_admin.profiles` | Perfil de aplicacion asociado a `auth.users` |
| Organizaciones | `recalc_admin.organizations` | Tenants/organizaciones |
| Membresia | `recalc_admin.organization_members` | Usuario, organizacion, rol y estado |
| Autorizacion | `recalc_admin.roles`, `permissions`, `role_permissions` | Catalogo de roles y permisos |
| Archivos | `recalc_admin.file_assets` | Metadata de objetos en Supabase Storage |
| Inbox | `recalc_admin.inbox_threads`, `inbox_messages` | Conversaciones persistentes |
| Capacitacion | `recalc_admin.training_rooms`, `training_messages` | Chats/salas persistentes |
| Migracion | `recalc_admin.migration_batches` | Auditoria tecnica de importaciones |

## Mapeo D1 a PostgreSQL

| D1 / SQLite | PostgreSQL | Transformacion |
| --- | --- | --- |
| `cloudflare_auth_user` | `recalc_admin.profiles` | `id/auth_user_id -> id`, `email` a lowercase, nombres opcionales |
| `organization` | `recalc_admin.organizations` | `slug/code/id -> slug`, `owner_user_id/created_by -> created_by` |
| `organization_member` | `recalc_admin.organization_members` | `is_active` a `active/disabled`, `role` a enum |
| `file_asset` | `recalc_admin.file_assets` | `r2_key/object_key -> object_path`, `bucket -> bucket_id` |
| `conversation` | `recalc_admin.inbox_threads` | `conversation` se normaliza como thread |
| `conversation_message` | `recalc_admin.inbox_messages` | `conversation_id -> thread_id`, `metadata_json` a `jsonb` |
| `training_chat` | `recalc_admin.training_rooms` | `title/name -> name` |
| `training_message` | `recalc_admin.training_messages` | `training_chat_id -> room_id`, `content/text/body -> body` |
| `outbox_event` | Sin tabla realtime | No se importa para realtime nativo; revisar por integraciones antes de eliminar |

## Diferencias de tipos

| SQLite/D1 | PostgreSQL | Nota |
| --- | --- | --- |
| `TEXT` usado como id | `uuid` | Los scripts preservan UUID existentes; filas no UUID requieren transformacion manual |
| `INTEGER` booleano | `boolean` / enum de estado | `0/1`, `true/false`, `yes/no` se normalizan |
| `TEXT` fecha | `timestamptz` | Fechas parseables se convierten a ISO; valores invalidos requieren revision |
| JSON como `TEXT` | `jsonb` | `metadata_json` se parsea; JSON invalido queda `{}` |
| FK logicas | FK reales | La migracion crea relaciones con `on delete` explicito |
| Roles libres | `organization_role` enum | Valores fuera de `owner/admin/member` requieren limpieza previa |

## Constraints e indices

- PK reales en todas las tablas principales.
- FK desde membresias, mensajes, archivos y organizaciones.
- Indices por `organization_id`, `user_id`, `created_at` y relaciones de mensajes.
- `created_at` y `updated_at` consistentes.
- Triggers `set_updated_at()` para tablas mutables.
- Checks de slug, estados, visibilidad y tamanos no negativos.

## RLS

La migracion habilita RLS en todas las tablas de `recalc_admin`.

Principios aplicados:

- `profiles`: el usuario lee/actualiza su perfil y puede leer perfiles con organizacion compartida.
- `organizations`: solo miembros activos leen; owners/admins actualizan.
- `organization_members`: miembros leen la membresia de su organizacion; owners/admins administran.
- `file_assets`: lectura por visibilidad, ownership o membresia; escritura por owner miembro.
- `inbox_*` y `training_*`: lectura e insercion limitada a miembros de la organizacion.
- `migration_batches`: cerrado para usuarios normales; solo service role puede operar.

Las funciones auxiliares `current_user_is_org_member`, `current_user_is_org_admin` y `current_user_shares_org_with` son `security definer` para evitar politicas recursivas. No sustituyen autorizacion en codigo; solo encapsulan validaciones RLS.

## Orden de carga

1. `profiles`
2. `organizations`
3. `organization_members`
4. `file_assets`
5. `inbox_threads`
6. `inbox_messages`
7. `training_rooms`
8. `training_messages`

Este orden respeta FK. Si el origen contiene organizaciones antes que usuarios, el transformador puede producir JSONL igualmente, pero el import debe ejecutarse en este orden.

## Scripts

Todos los scripts evitan secretos en argumentos y tienen `--help`.

### Exportar D1

```bash
npm run migration:export-d1
npx tsx scripts/export-d1-data.ts --database=<d1-staging-db> --out=artifacts/d1-export --execute
```

Por defecto usa `--dry-run`. `--execute` solo debe usarse tras revisar el entorno D1 y confirmar que es lectura segura.

### Transformar

```bash
npm run migration:transform-d1
npx tsx scripts/transform-d1-to-postgres.ts --input=artifacts/d1-export --out=artifacts/postgres-import
```

Salida: un `.jsonl` por tabla objetivo y `manifest.json`.

### Importar a Supabase staging

```bash
npm run migration:import-supabase
NEXT_PUBLIC_SUPABASE_URL=<staging-url> SUPABASE_SERVICE_ROLE_KEY=<staging-service-role> \
  npx tsx scripts/import-supabase-data.ts --input=artifacts/postgres-import --apply
```

Requiere service role solo en CLI local/CI segura. Nunca se importa desde cliente ni se imprime la clave.

### Validar

```bash
npm run migration:validate-data
NEXT_PUBLIC_SUPABASE_URL=<staging-url> SUPABASE_SERVICE_ROLE_KEY=<staging-service-role> \
  npx tsx scripts/validate-migrated-data.ts --input=artifacts/postgres-import --remote
```

Sin `--remote`, valida conteos locales entre manifest y JSONL.

## Consultas de validacion

Conteos por tabla:

```sql
select 'profiles' as table_name, count(*) from recalc_admin.profiles
union all select 'organizations', count(*) from recalc_admin.organizations
union all select 'organization_members', count(*) from recalc_admin.organization_members
union all select 'file_assets', count(*) from recalc_admin.file_assets
union all select 'inbox_threads', count(*) from recalc_admin.inbox_threads
union all select 'inbox_messages', count(*) from recalc_admin.inbox_messages
union all select 'training_rooms', count(*) from recalc_admin.training_rooms
union all select 'training_messages', count(*) from recalc_admin.training_messages;
```

Miembros sin perfil:

```sql
select member.*
from recalc_admin.organization_members member
left join recalc_admin.profiles profile on profile.id = member.user_id
where profile.id is null;
```

Mensajes de inbox sin thread:

```sql
select message.*
from recalc_admin.inbox_messages message
left join recalc_admin.inbox_threads thread on thread.id = message.thread_id
where thread.id is null;
```

Mensajes con `organization_id` inconsistente:

```sql
select message.*
from recalc_admin.inbox_messages message
join recalc_admin.inbox_threads thread on thread.id = message.thread_id
where message.organization_id <> thread.organization_id;
```

Archivos sin objeto Storage asociado, despues de migrar Storage:

```sql
select asset.*
from recalc_admin.file_assets asset
left join storage.objects object
  on object.bucket_id = asset.bucket_id
 and object.name = asset.object_path
where asset.deleted_at is null
  and object.id is null;
```

## Estrategia de migracion de datos

1. Congelar una ventana de staging; no usar produccion para pruebas.
2. Exportar D1 staging en modo lectura.
3. Transformar JSON a JSONL PostgreSQL.
4. Revisar conteos y filas rechazadas antes del import.
5. Aplicar migracion SQL en Supabase staging.
6. Importar con `--apply` y lotes pequenos.
7. Validar conteos, FK y registros huerfanos.
8. Ejecutar pruebas de aplicacion contra staging.
9. Repetir con snapshot nuevo si hay delta.

## Rollback logico

Mientras Cloudflare produccion siga intacto, rollback de aplicacion significa apuntar trafico de nuevo a la ruta Cloudflare existente y descartar el Preview de Vercel.

Rollback de Supabase staging:

```sql
drop schema if exists recalc_admin cascade;
delete from storage.buckets
where id in ('documents', 'avatars', 'imports', 'exports', 'attachments');
```

No ejecutar contra produccion. Si ya existe data real en Supabase, preferir crear un proyecto staging limpio en vez de borrar.

## Transformaciones especiales

- `profiles.id` debe coincidir con `auth.users.id`. Si el origen no tiene UUID compatible con Supabase Auth, se requiere tabla de equivalencias.
- `outbox_event` no se usa para realtime nativo. Si tambien alimenta webhooks/integraciones, debe separarse antes de eliminarlo.
- Los paths de Storage se normalizaran como `organizations/{organizationId}/users/{userId}/{resourceId}/{filename}` donde aplique.
- `metadata_json` invalido se convierte a `{}` en el transformador; revisar logs y muestras antes del import final.
- Los roles fuera de `owner`, `admin`, `member` deben mapearse antes del import.

## Validaciones ejecutadas localmente

| Validacion | Comando | Resultado |
| --- | --- | --- |
| Typecheck despues de migracion SQL/scripts | `npm run typecheck` | OK |
| Export D1 dry-run | `npx tsx scripts/export-d1-data.ts --dry-run --out=.tmp/migration-dry-run/d1-select` | OK, no remoto |
| Transform dry-run | `npx tsx scripts/transform-d1-to-postgres.ts --dry-run --input=.tmp/migration-dry-run/d1 --out=.tmp/migration-dry-run/pg` | OK |
| Import dry-run | `npx tsx scripts/import-supabase-data.ts --dry-run --input=.tmp/migration-dry-run/pg` | OK, no remoto |
| Fixture D1 -> JSONL | `npx tsx scripts/transform-d1-to-postgres.ts --input=.tmp/migration-fixture/d1 --out=.tmp/migration-fixture/pg` | OK, 7 filas |
| Validacion local fixture | `npx tsx scripts/validate-migrated-data.ts --input=.tmp/migration-fixture/pg` | OK, conteos coinciden |

## Pendientes

- Ejecutar `supabase db reset` local cuando el CLI este disponible.
- Aplicar migracion en Supabase staging.
- Validar RLS con usuarios reales de staging.
- Validar publicaciones Realtime contra Postgres changes.
- Ejecutar import remoto solo con credenciales staging.
