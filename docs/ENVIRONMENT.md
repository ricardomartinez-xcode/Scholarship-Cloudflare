# Environment Variables

## Core runtime
- `NEXT_PUBLIC_APP_URL`: URL publica de la aplicacion.
- `NEXT_PUBLIC_SUPABASE_URL`: URL publica del proyecto Supabase.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: anon/publishable key para browser y SSR.
- `DATABASE_URL`: conexion pooled de Supabase PostgreSQL para Prisma. En Vercel
  tambien se acepta `POSTGRES_PRISMA_URL` o `POSTGRES_URL`.
- `DIRECT_URL`: conexion directa de Supabase PostgreSQL para migraciones. En
  Vercel tambien se acepta `POSTGRES_URL_NON_POOLING` o
  `DATABASE_URL_UNPOOLED`.
- `SUPABASE_SERVICE_ROLE_KEY`: opcional, server-only; requerida por diagnosticos
  administrativos y scripts de migracion. Nunca usar prefijo `NEXT_PUBLIC_`.

La aplicacion no usa `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET`,
`NEON_AUTH_WEBHOOK_SECRET` ni `NEON_API_KEY` en la ruta activa.

## Access bootstrap
- `ADMIN_EMAIL`: correo protegido para bootstrap/manual owner flows. Ya no otorga escalación automática al iniciar sesión.
- `ADMIN_PUBLISH_EMAILS`: lista CSV opcional de correos con permiso de publicación adicional.
- `ALLOWED_EMAILS`: lista CSV opcional de correos permitidos para acceso fuera del dominio.
- `ALLOWED_EMAIL_DOMAINS`: lista CSV opcional de dominios permitidos.

## SMTP
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`

## Scripts historicos Neon PostgreSQL
Los scripts de compatibilidad para la base de datos anterior no forman parte del
build, runtime ni autenticacion de Vercel. Cuando se usan manualmente para
auditoria o rollback, resuelven la conexion en este orden:

1. `NEON_HTTP_SQL_URL` + `NEON_CONNECTION_STRING`
2. `DIRECT_URL` / `DATABASE_URL`
3. `NEON_HOST` + `NEON_USER` + `NEON_PASSWORD`/`NEON_PASS` + `NEON_DATABASE`/`NEON_DB`

## Notes
- No dejes connection strings ni secretos dentro de scripts versionados.
- `ADMIN_EMAIL` ya no debe tratarse como bypass de permisos. El acceso real vive en la base de datos.
