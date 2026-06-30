# Scholarship Cloudflare: Keycloak detrás de Cloudflare Access

## Objetivo y alcance

Usar el mismo inicio de sesión federado que PSCV-ROOM:

```text
Usuario administrativo
  -> Cloudflare Access
    -> Keycloak
      -> Microsoft Entra ID / Google
  -> Scholarship Cloudflare
  -> Neon / Better Auth y roles internos
```

Cloudflare Access es la barrera exterior de identidad. Neon/Better Auth continúa siendo la autorización interna existente para el panel y las API administrativas. Esta separación evita migrar sesiones, tablas, roles y callbacks de la aplicación durante un cambio de perímetro.

## Alcance recomendado

La calculadora y los flujos públicos no deben quedar bloqueados por error. La aplicación Access debe proteger inicialmente sólo:

```text
/admin/*
/api/admin/*
```

No cubras la raíz, cotizadores públicos ni rutas de datos de usuario con esta primera política sin una revisión funcional explícita. El middleware actual ya exige una sesión Neon/Better Auth para esas rutas administrativas; Access agrega autenticación institucional antes de esa capa.

## Requisito bloqueante: hostname canónico

El Worker `scholarship-cloudflare` no declara en `apps/web/wrangler.jsonc` una ruta o dominio personalizado de producción. Antes de crear la aplicación Access, define y publica un único hostname canónico de Scholarship en Cloudflare.

No apuntes Access a un alias temporal, preview de Vercel o URL `workers.dev`. El hostname elegido debe servir el Worker `scholarship-cloudflare` y conservar los bindings D1, R2 y correo configurados para ese entorno.

## Configurar Keycloak

1. Reutiliza el realm institucional de Keycloak usado por PSCV-ROOM o crea uno equivalente.
2. Integra Microsoft Entra ID y Google como Identity Providers upstream.
3. Crea un cliente OIDC confidencial para Cloudflare Access:
   - Client ID sugerido: `cloudflare-access-scholarship`.
   - Standard Flow: habilitado.
   - Direct Access Grants, Implicit Flow y Service Accounts: deshabilitados.
   - Scopes: `openid`, `email`, `profile`.
   - Redirect URI: `https://<TEAM>.cloudflareaccess.com/cdn-cgi/access/callback`.
   - PKCE: `S256` cuando corresponda.
4. Conserva el atributo `email` verificado y estable.

El client secret del cliente OIDC queda sólo en Keycloak y Cloudflare Zero Trust. Nunca debe estar en el repositorio, en `wrangler.jsonc`, en variables `NEXT_PUBLIC_*` ni en el navegador.

## Configurar Cloudflare Zero Trust

1. Agrega Keycloak como Identity Provider de tipo OpenID Connect usando el discovery document:

   ```text
   https://<KEYCLOAK_HOST>/realms/<REALM>/.well-known/openid-configuration
   ```

2. Crea una aplicación Access Self-hosted para el hostname canónico de Scholarship.
3. Declara dos rutas de aplicación, o dos aplicaciones separadas, para `/admin/*` y `/api/admin/*`.
4. Habilita el método de inicio de sesión Keycloak.
5. Agrega una política Allow restringida a grupos, dominios o identidades administrativas. Evita una regla de bypass general.
6. Prueba el login de Microsoft y Google antes de aplicar la política a producción.

## Compatibilidad con el código actual

No se requiere un cliente OAuth de Keycloak dentro de Next.js para este diseño. Cloudflare Access se encarga de redirigir al usuario, administrar la sesión y controlar la entrada. Scholarship conserva:

- `apps/web/middleware.ts` para requerir la sesión de Neon/Better Auth en el área administrativa.
- Las reglas actuales de dominio, rol y datos dentro de la aplicación.
- Los callbacks de autenticación existentes de Neon/Better Auth.

No elimines Neon/Better Auth ni migres cookies durante la primera fase. Una eventual unificación de usuarios o roles con Keycloak debe ser un proyecto separado, con migración, rollback y pruebas de autorización.

## Validación de publicación

1. Solicita `/admin` sin sesión Access y confirma la redirección a Cloudflare Access/Keycloak.
2. Completa el login Microsoft o Google y confirma que Access permite llegar a Scholarship.
3. Confirma que Scholarship aún solicita la sesión Neon/Better Auth en `/admin` cuando corresponda.
4. Confirma que la calculadora pública y sus rutas públicas siguen funcionando sin sesión Access.
5. Revisa logs de Access, Sentry y la aplicación sin registrar tokens, cookies ni headers de autenticación.

## Cambio controlado

Este documento no cambia DNS, rutas, Worker, Access ni secretos. El cambio productivo debe ejecutarse primero en un hostname de staging, con un plan auditado y aprobación explícita después de validar los flujos anteriores.
