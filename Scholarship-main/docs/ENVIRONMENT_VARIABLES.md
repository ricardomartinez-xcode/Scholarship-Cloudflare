# Environment Variables (V2)

## Base de datos / Prisma
- `DATABASE_URL`
- `DIRECT_DATABASE_URL` (si aplica)

## Auth
- Variables Neon Auth (según `src/lib/auth/server.ts`, `src/lib/authz.ts`)
- Variables Google OAuth (`src/lib/google-integration.ts`)

## Supabase Realtime
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` preferida para cliente. `NEXT_PUBLIC_SUPABASE_ANON_KEY` queda solo como fallback legacy.
- `SUPABASE_URL` para llamadas server-side.
- `SUPABASE_SERVICE_ROLE_KEY` (sólo servidor)
- `SUPABASE_REALTIME_JWT_SECRET` (sólo servidor, debe ser el JWT Secret del proyecto Supabase)

Las variables `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
son públicas por diseño: se usan en el navegador para conectar Supabase Realtime.
No deben dar acceso a datos sin el JWT corto que emite `/api/realtime/token` y las
políticas RLS de `realtime.messages`. Nunca crear variables con nombres como
`NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_SECRET_KEY` o
`NEXT_PUBLIC_SUPABASE_REALTIME_JWT_SECRET`.

## Meta / WhatsApp
- Variables definidas en `src/lib/meta-whatsapp.ts` y `src/lib/meta-embedded-signup.ts`
- Nunca exponer tokens/meta secrets al cliente.
