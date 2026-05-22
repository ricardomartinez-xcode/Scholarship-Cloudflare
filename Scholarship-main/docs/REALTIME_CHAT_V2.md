# Realtime Chat V2 (Supabase + Prisma)

## Auditoría actual
- Realtime topics: `src/lib/realtime-topics.ts`.
- Cliente browser Supabase: `src/lib/supabase/client.ts`.
- Broadcast server: `src/lib/supabase/server-realtime.ts`.
- Persistencia inbox: `src/lib/inbox-service.ts`.
- APIs inbox: `src/app/api/unidep/inbox/threads/**`.

## Implementación V2 parcial

### Capa realtime nueva
- `src/server/realtime/supabase-browser-client.ts`
- `src/server/realtime/supabase-server-client.ts`
- `src/server/realtime/channels.ts`
- `src/server/realtime/messaging-service.ts`
- `src/server/realtime/presence-service.ts`
- `src/server/realtime/typing-service.ts`
- `src/server/realtime/notifications-service.ts`

### Capa dominio inbox nueva
- `src/domains/inbox/inbox-repository.ts`
- `src/domains/inbox/conversation-service.ts`
- `src/domains/inbox/message-service.ts`
- `src/domains/inbox/permissions.ts`

## Seguridad
- No se expone `service_role` al cliente.
- Broadcast de mensajes se mantiene server-side.
