# Migracion de Realtime a Supabase nativo

## Estado

- Mensajes persistentes: Supabase Realtime `postgres_changes`.
- Presencia: Supabase Presence.
- Broadcast server-side legacy: eliminado de la ruta principal; los hooks de servidor quedan como no-op de compatibilidad.
- Endpoint JWT propio `/api/realtime/token`: eliminado.
- Estado remoto: no validado contra Supabase staging.

## Eventos actuales encontrados

| Caso | Implementacion anterior | Problema |
| --- | --- | --- |
| Inbox thread messages | D1/outbox en Cloudflare o RPC `broadcast` hacia Supabase | Duplicaba persistencia y transporte |
| Training chat messages | RPC `broadcast` hacia Supabase | Evento persistente enviado como evento efimero |
| Presence inbox/training | Supabase Presence con token propio por topic | Token paralelo a Supabase Auth |
| Typing | Topic de Presence | Efimero; puede permanecer como Presence/Broadcast si se reactiva |

## Eventos nuevos

| Caso | Supabase Realtime | Tabla | Filtro |
| --- | --- | --- | --- |
| Inbox messages | `postgres_changes` | `recalc_admin.inbox_message` | `threadId=eq.<threadId>` |
| Training messages | `postgres_changes` | `recalc_admin."TrainingMessage"` | `chatId=eq.<chatId>` |
| Inbox presence | Presence | `inbox:thread:<threadId>:presence` | Canal privado |
| Training room presence | Presence | `training:room:<roomId>:presence` | Canal privado |
| Training chat presence | Presence | `training:chat:<chatId>:presence` | Canal privado |

Los mensajes no se insertan en el estado cliente desde el payload raw de Realtime. El hook recibe el cambio Postgres y recarga el historial con la API existente, para conservar el shape actual con `sender`, permisos y normalizacion del backend.

## Archivos principales

| Archivo | Cambio |
| --- | --- |
| `apps/web/src/lib/supabase/client.ts` | Agrega `subscribeToPostgresMessages`; usa browser client Supabase Auth |
| `apps/web/src/hooks/useRealtimeMessages.ts` | Sustituye Broadcast por `postgres_changes` |
| `apps/web/src/hooks/useRealtimePresence.ts` | Conserva Presence y limpieza de canal |
| `apps/web/src/lib/supabase/server-realtime.ts` | No-op de compatibilidad; la DB emite cambios |
| `apps/web/src/app/api/realtime/token/route.ts` | Eliminado |
| `apps/web/src/lib/realtime-token.ts` | Eliminado |
| `supabase/migrations/20260710211500_realtime_postgres_changes.sql` | Publica tablas de mensajes en `supabase_realtime` cuando existan |

## Autorizacion

La autorizacion efectiva se divide en dos capas:

1. APIs de historial y escritura: `getSessionUser`, permisos de dominio y queries Prisma.
2. Supabase Realtime: JWT de Supabase Auth y RLS/Postgres publication.

Para staging se debe completar la RLS de las tablas Prisma activas si se exponen directamente a Realtime:

- `recalc_admin.inbox_message`
- `recalc_admin."TrainingMessage"`
- tablas de participantes relacionadas.

La migracion base ya incluye RLS para las tablas nuevas `recalc_admin.inbox_messages` y `recalc_admin.training_messages`. Las tablas Prisma heredadas necesitan politicas equivalentes o migrarse al esquema nuevo antes de habilitar Realtime en staging.

## Reconexion y degradacion

- Supabase client maneja reconexion del canal.
- El hook conserva polling opcional `refreshIntervalMs`.
- Si Realtime falla, el usuario conserva historial inicial y polling cuando esta configurado.
- Al desmontar, se remueve el canal con `removeChannel`.
- No se llama `realtime.disconnect()` global para no cortar otros canales activos.

## Pruebas requeridas

| Prueba | Estado |
| --- | --- |
| Suscripcion a INSERT inbox | Pendiente Supabase staging |
| Suscripcion a UPDATE inbox | Pendiente Supabase staging |
| Suscripcion a DELETE inbox | Pendiente Supabase staging |
| Filtro por thread | Pendiente Supabase staging |
| Suscripcion training por chat | Pendiente Supabase staging |
| Limpieza de canal al desmontar | Cubierto por implementacion; pendiente browser |
| Reconexión | Pendiente browser/staging |
| Ausencia de duplicados | El hook recarga historial autorizado; pendiente E2E |
| Presence join/leave/sync | Pendiente staging |

## Validaciones locales

| Validacion | Comando | Resultado |
| --- | --- | --- |
| Typecheck tras cambio realtime | `npm run typecheck` | OK |

## Pendientes

- Ejecutar migraciones en Supabase staging.
- Confirmar que `supabase_realtime` publication incluye las tablas activas.
- Definir RLS final para tablas Prisma heredadas o completar corte a tablas SQL nuevas.
- Ejecutar prueba con dos sesiones autenticadas en Vercel Preview/local.
- Retirar componentes de diagnóstico `outbox_event` cuando se confirme que no sirven a integraciones/webhooks.
