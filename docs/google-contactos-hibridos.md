# Manual de configuración Google para contactos híbridos

## Qué hace este flujo

ReCalc usa un modelo híbrido:

- `Supabase PostgreSQL` conserva el índice operativo mínimo de contactos.
- `Google Sheets` guarda una libreta editable por usuario en el Drive de la cuenta Google conectada.

Cuando la sincronización está activa:

1. los contactos siguen funcionando en la web y en la extensión;
2. el sistema escribe una copia estructurada en un workbook con `Campañas`, `Seguimiento`, `Contactos` y `Metadatos`;
3. si el usuario aún no tiene `spreadsheetId`, ReCalc crea el archivo automáticamente con el OAuth de ese usuario.

No se usa una hoja pública compartida para operación diaria. Cada usuario ve solo el archivo creado en su propia cuenta conectada; Supabase PostgreSQL sigue siendo la fuente de verdad y Sheets es la copia operativa editable/exportable.

## Requisitos previos

Debes tener estas variables de entorno disponibles en la app:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_OAUTH_REDIRECT_URI`
- `GOOGLE_INTEGRATION_SECRET`

### Cliente OAuth compartido vs cliente dedicado

La app ya soporta dos modos:

1. `Cliente compartido` `recomendado`
   - Supabase Auth usa tus credenciales OAuth de Google para el login social.
   - La sincronización Google de ReCalc usa ese mismo cliente.
   - En este caso debes cargar en la app:
     - `GOOGLE_CLIENT_ID`
     - `GOOGLE_CLIENT_SECRET`
     - `GOOGLE_OAUTH_REDIRECT_URI`
   - Importante:
     - en Supabase Dashboard, configura el proveedor Google con ese mismo client ID y secret;
     - el redirect URI de login debe apuntar al callback Auth del proyecto Supabase.

2. `Cliente dedicado para sync`
   - Supabase Auth sigue usando su cliente configurado en Supabase Dashboard.
   - La sincronización Google usa otro cliente distinto.
   - En ese caso debes cargar:
     - `GOOGLE_SYNC_CLIENT_ID`
     - `GOOGLE_SYNC_CLIENT_SECRET`
     - `GOOGLE_SYNC_OAUTH_REDIRECT_URI`

Si detectas cualquier variable `GOOGLE_SYNC_*`, la app usa el modo dedicado y deja de leer `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` para la sincronización.

## Configuración en Google Cloud

### 1. Crear o usar un proyecto

En [Google Cloud Console](https://console.cloud.google.com/):

1. crea un proyecto nuevo o usa uno existente;
2. activa estas APIs:
   - Google Calendar API
   - Google Tasks API
   - Google Sheets API

### 2. Configurar OAuth consent screen

1. entra a `APIs & Services` → `OAuth consent screen`;
2. selecciona tipo `External` si los usuarios no están dentro de un dominio corporativo cerrado;
3. completa nombre de app, correo de soporte y dominios autorizados;
4. agrega los scopes necesarios:
   - `https://www.googleapis.com/auth/calendar.events`
   - `https://www.googleapis.com/auth/tasks`
   - `https://www.googleapis.com/auth/spreadsheets`
   - `openid`
   - `email`
   - `profile`

### 3. Crear credenciales OAuth

1. entra a `APIs & Services` → `Credentials`;
2. crea credenciales `OAuth client ID`;
3. tipo: `Web application`;
4. en `Authorized redirect URIs` agrega exactamente los callbacks que usará ese cliente.

### Si usas un solo cliente para login + sync

Ese mismo cliente debe tener autorizados estos dos redirect URIs:

```text
${NEXT_PUBLIC_SUPABASE_URL}/auth/v1/callback
https://recalc.relead.com.mx/api/integrations/google/callback
```

El primero lo usa Supabase Auth para `Continuar con Google`. Se deriva de `NEXT_PUBLIC_SUPABASE_URL`.
El segundo lo usa ReCalc para Calendar, Tasks y Sheets.

### Si usas cliente dedicado para sync

El cliente del login se queda en Supabase Auth y el cliente nuevo de sync debe tener:

```text
https://recalc.relead.com.mx/api/integrations/google/callback
```

Para local, si vas a probar localmente:

```text
http://localhost:3000/api/integrations/google/callback
```

## Variables de entorno

Ejemplo:

```env
GOOGLE_CLIENT_ID=tu-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=tu-client-secret
GOOGLE_OAUTH_REDIRECT_URI=https://recalc.relead.com.mx/api/integrations/google/callback
GOOGLE_INTEGRATION_SECRET=una-clave-larga-y-aleatoria
```

### Ejemplo con cliente dedicado para sync

```env
GOOGLE_SYNC_CLIENT_ID=tu-client-id-sync.apps.googleusercontent.com
GOOGLE_SYNC_CLIENT_SECRET=tu-client-secret-sync
GOOGLE_SYNC_OAUTH_REDIRECT_URI=https://recalc.relead.com.mx/api/integrations/google/callback
GOOGLE_INTEGRATION_SECRET=una-clave-larga-y-aleatoria
```

### Recomendación para `GOOGLE_INTEGRATION_SECRET`

Usa una cadena larga, privada y estable. Esa clave cifra los tokens de Google guardados por la app.

## Activación desde la app

Una vez desplegadas las variables:

1. entra a `/unidep`;
2. abre la pestaña `Contactos`;
3. pulsa `Conectar Google` si la cuenta aún no está vinculada;
4. autoriza acceso a Calendar, Tasks y Sheets;
5. vuelve a `Contactos`;
6. pulsa `Activar / sincronizar`.

## Qué crea automáticamente el sistema

Si `syncSheetsEnabled` está activo y el usuario no tiene hoja configurada:

1. ReCalc crea un spreadsheet nuevo llamado `Seguimiento de prospectos ReLead`;
2. crea las hojas `Campañas`, `Seguimiento`, `Contactos` y `Metadatos`;
3. replica campañas, seguimiento sintetizado y contactos del usuario;
4. conserva el `spreadsheetId` en `recalc_admin.agenda_sync_preference`.

Si después el usuario activa sincronización de agenda, la hoja `Agenda` se agrega al mismo archivo.

## Cómo verificar que quedó bien

### En UI

En `Contactos` debes ver:

- estado `Sheets activo`;
- sin error de sincronización;
- contactos reflejados en `Contactos`;
- campañas reflejadas en `Campañas`;
- bitácora de prospectos disponible en `Seguimiento`.

### En base

La tabla `recalc_admin.user_google_connection` debe mostrar:

- `status = connected`
- `sheetsConnected = true`

Y `recalc_admin.agenda_sync_preference` debe mostrar:

- `syncSheetsEnabled = true`
- `spreadsheetId` con valor

## Qué hace cada cambio de contacto

Cuando guardas, importas o actualizas contactos:

1. ReCalc actualiza el índice operativo en Supabase PostgreSQL;
2. si Google Sheets está activo, reescribe la hoja `Contactos`;
3. si hay error con Google, la operación local no se pierde, pero el error queda visible como `lastSyncError`.

## Alcance actual

Este flujo deja resuelto:

- base por usuario;
- edición desde web;
- edición desde extensión;
- importación rápida;
- vínculo opcional con cotización/escenario;
- conteo de mensajes de campañas;
- réplica a Google Sheets.

No resuelve todavía:

- base global compartida entre usuarios;
- reglas avanzadas de ownership entre asesores;
- deduplicación cross-user;
- sincronización bidireccional desde cambios hechos directamente en la hoja.

## Siguiente nivel recomendado

Si después quieres operar también una base global:

1. mantener hojas por usuario para trabajo diario;
2. agregar una hoja maestra consolidada;
3. definir reglas de merge por teléfono normalizado;
4. decidir si la consolidación será manual, por botón o programada.
