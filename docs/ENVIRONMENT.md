# Environment Variables

## Core runtime
- `DATABASE_URL`: runtime Prisma URL. Puede ser `prisma+postgres://` o `postgres://`.
- `DIRECT_URL`: conexión directa `postgres://` para migraciones Prisma.
- `NEON_AUTH_BASE_URL`: base URL del servicio Neon Auth.
- `NEON_AUTH_COOKIE_SECRET`: secreto de sesión para Neon Auth.

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

## Neon HTTP scripts
Los scripts Python históricos que usan el endpoint HTTP de Neon resuelven la conexión en este orden:

1. `NEON_HTTP_SQL_URL` + `NEON_CONNECTION_STRING`
2. `DIRECT_URL` / `DATABASE_URL`
3. `NEON_HOST` + `NEON_USER` + `NEON_PASSWORD`/`NEON_PASS` + `NEON_DATABASE`/`NEON_DB`

## Notes
- No dejes connection strings ni secretos dentro de scripts versionados.
- `ADMIN_EMAIL` ya no debe tratarse como bypass de permisos. El acceso real vive en la base de datos.
