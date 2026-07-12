# Environment Variables (V2)

## Base de datos / Prisma
- `DATABASE_URL` o alias Vercel `POSTGRES_PRISMA_URL` / `POSTGRES_URL`
- `DIRECT_URL` o alias Vercel `POSTGRES_URL_NON_POOLING` / `DATABASE_URL_UNPOOLED`

## Auth
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` o `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` solo para Admin API y tareas server-only
- `NEXT_PUBLIC_SUPABASE_GOOGLE_ENABLED=1` solo despues de habilitar Google en Supabase
- Variables Google OAuth (`src/lib/google-integration.ts`)

No se requieren variables `NEON_AUTH_*` para iniciar sesion, refrescar cookies,
proteger rutas ni ejecutar el diagnostico de usuarios.

## Supabase Realtime
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` o `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Las variables `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
son públicas por diseño: se usan en el navegador para conectar Supabase Realtime.
El cliente usa la sesion de Supabase Auth y las politicas RLS; no existe un JWT
paralelo emitido por `/api/realtime/token`. Nunca crear variables con nombres como
`NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_SECRET_KEY` o
`NEXT_PUBLIC_SUPABASE_REALTIME_JWT_SECRET`.

## Meta / WhatsApp
- Variables definidas en `src/lib/meta-whatsapp.ts` y `src/lib/meta-embedded-signup.ts`
- Nunca exponer tokens/meta secrets al cliente.
