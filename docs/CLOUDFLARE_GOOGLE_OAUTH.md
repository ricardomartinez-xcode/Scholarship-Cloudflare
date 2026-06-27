# Google OAuth en Cloudflare Workers

Esta integración conecta una organización de Recalc con Google Drive, Google Sheets y/o Google Calendar sin usar Neon Auth, Prisma ni el SDK de Google para Node.

## Requisitos de despliegue

1. Aplica las migraciones D1 hasta `0009_google_oauth_state.sql`.
2. Configura en el Worker estos secretos, sin subirlos al repositorio:

```bash
wrangler secret put GOOGLE_OAUTH_CLIENT_ID
wrangler secret put GOOGLE_OAUTH_CLIENT_SECRET
wrangler secret put GOOGLE_OAUTH_REDIRECT_URI
wrangler secret put GOOGLE_TOKEN_ENCRYPTION_KEY
wrangler secret put GOOGLE_TOKEN_ENCRYPTION_KEY_VERSION
```

`GOOGLE_TOKEN_ENCRYPTION_KEY` debe ser una clave de 32 bytes codificada como base64url. `GOOGLE_TOKEN_ENCRYPTION_KEY_VERSION` puede iniciar en `v1` y debe cambiarse cuando se rote la clave.

3. Registra en Google Cloud Console exactamente la misma URL de callback indicada en `GOOGLE_OAUTH_REDIRECT_URI`, por ejemplo:

```text
https://recalc.relead.com.mx/api/integrations/google/callback
```

## Inicio de conexión

Un usuario administrativo debe pertenecer a la organización como `owner` o `admin`.

```text
GET /api/integrations/google/connect?organizationId=<org-id>&resources=drive,sheets,calendar&returnTo=/admin
```

`resources` acepta una lista separada por comas:

- `drive` → `drive.file`
- `sheets` → `spreadsheets`
- `calendar` → `calendar.events`

Cuando se omite, se solicitan los tres recursos para mantener compatibilidad con una conexión general. Las pantallas específicas deben enviar sólo los recursos que realmente utilizarán.

## Controles aplicados

- Código de autorización OAuth con PKCE S256.
- `state` de un solo uso, almacenado únicamente como hash y con expiración de diez minutos.
- Verifier PKCE cifrado con AES-GCM y eliminado después de consumirse.
- Refresh y access tokens cifrados en D1; nunca se exponen en JSON, URL, logs o cookies.
- La organización y la membresía activa se validan al iniciar y al terminar el callback.
- El callback requiere que la sesión administrativa original siga activa.

## Alcance actual

Este bloque habilita la **conexión OAuth y persistencia segura**. Las tareas de sincronización Drive/Sheets/Calendar continúan pendientes de un consumidor de `google_sync_job` mediante Queues o Workflows; no deben ejecutarse durante el request HTTP del callback.
