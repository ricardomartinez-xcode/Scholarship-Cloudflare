# Capacitacion / Rolplay - Supabase Realtime

## Arquitectura actual

Rolplay persiste salas, miembros y mensajes en Supabase PostgreSQL. Prisma sigue
siendo el cliente transitorio de las APIs de dominio mientras se completa la
consolidacion de repositorios.

- Mensajes persistentes: `postgres_changes` filtrado por `chatId`.
- Estado online: Supabase Presence por sala o chat.
- Identidad: sesion Supabase Auth del navegador.
- Historial y permisos: APIs de aplicacion con autorizacion de dominio.

Los mensajes no se publican como Broadcast. Tras recibir un cambio PostgreSQL,
el hook recarga el historial autorizado para mantener el mismo shape de datos y
evitar confiar en payloads de cliente.

## Componentes

- `apps/web/src/lib/supabase/client.ts`: Postgres Changes y Presence.
- `apps/web/src/hooks/useRealtimeMessages.ts`: suscripcion y recarga de historial.
- `apps/web/src/hooks/useRealtimePresence.ts`: presencia y limpieza de canales.
- `supabase/migrations/20260710211500_realtime_postgres_changes.sql`: publication.

## Variables

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
DATABASE_URL=
DIRECT_URL=
```

La service role y las conexiones PostgreSQL son server-only. Las suscripciones
browser usan la sesion de Supabase Auth y dependen de RLS; no requieren un JWT
paralelo ni `SUPABASE_REALTIME_JWT_SECRET`.

## Validacion pendiente

1. Aplicar las migraciones versionadas en Supabase staging.
2. Confirmar la publication de la tabla de mensajes activa.
3. Validar RLS con usuarios de dos organizaciones distintas.
4. Abrir dos sesiones en Vercel Preview y comprobar INSERT/UPDATE, reconexion y
   limpieza de canal.
5. Confirmar que polling mantiene el historial utilizable si Realtime falla.

El inventario completo y el estado de pruebas estan en
`docs/realtime-migration.md`.
