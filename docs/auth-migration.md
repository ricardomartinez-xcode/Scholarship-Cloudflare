# Migracion de autenticacion a Supabase Auth

## Estado

- Proveedor objetivo: Supabase Auth.
- Cliente browser: `apps/web/src/lib/auth/client.ts` sobre `createSupabaseBrowserClient`.
- Cliente server: `apps/web/src/lib/auth/server.ts` sobre `createSupabaseServerClient`.
- Cliente middleware: `apps/web/src/lib/supabase/middleware.ts`.
- Callback SSR: `apps/web/src/app/(public)/auth/callback/route.ts`.
- Estado remoto: no validado contra Supabase staging.

## Modelo de identidad

Supabase Auth es la fuente de identidad primaria. Las filas de dominio se mantienen separadas:

- `auth.users`: usuario autenticado, credenciales, proveedores OAuth, email/phone.
- `recalc_admin.profiles`: perfil de aplicacion asociado por `profiles.id = auth.users.id`.
- `recalc_admin.organizations`: tenant/organizacion.
- `recalc_admin.organization_members`: membresia por organizacion, rol y estado.
- Tablas Prisma existentes en `recalc_admin`: siguen siendo usadas temporalmente como modelo de dominio mientras se termina la consolidacion completa de datos.

No se usa `SUPABASE_SERVICE_ROLE_KEY` en cliente ni en flujos normales de usuario.

## Flujo de sesion

1. El usuario inicia sesion con email/password, magic link, OTP o Google.
2. El cliente o route handler llama Supabase Auth.
3. Supabase emite cookies gestionadas por `@supabase/ssr`.
4. `apps/web/middleware.ts` llama `auth.getClaims()` para refrescar cookies y verificar sujeto autenticado.
5. Server Components y Route Handlers resuelven usuario con `auth.getSession()`, que internamente usa `supabase.auth.getUser()`.
6. `authz.ts` sincroniza o resuelve el usuario de dominio por `authUserId`/email.
7. `admin-session.ts` aplica rol/capabilities de dominio.

## Clientes

| Cliente | Archivo | Uso | Secretos |
| --- | --- | --- | --- |
| Browser | `apps/web/src/lib/auth/client.ts` | OAuth, magic link, OTP, reset, phone OTP | Solo anon key publica |
| Server | `apps/web/src/lib/auth/server.ts` | password sign-in/sign-up, sign-out, password change, user lookup | Solo anon key via cookies |
| Middleware | `apps/web/src/lib/supabase/middleware.ts` | Refresh de cookies y claims | Solo anon key publica |
| Admin | `apps/web/src/lib/supabase/admin.ts` | Migraciones/scripts o tareas privilegiadas puntuales | Service role, server-only |

## Rutas y redirecciones

| Ruta | Responsabilidad |
| --- | --- |
| `/auth/sign-in` | UI publica de inicio de sesion |
| `/auth/sign-up` | UI publica de registro/invitacion |
| `/auth/callback` | Intercambia `code` por sesion Supabase y redirige |
| `/auth/after-login` | Aplica autorizacion de dominio y redirige al destino final |
| `/auth/forgot-password` | Solicita email de recuperacion |
| `/auth/reset-password` | Actualiza password con sesion de recovery activa |
| `/api/auth/sign-in` | Email/password publico |
| `/api/auth/sign-up` | Registro email/password |
| `/api/admin/sign-in` | Email/password admin |
| `/api/extension/auth/sign-in` | Emite token interno de extension tras validar Supabase Auth |

Los destinos `next` se sanitizan: solo paths internos, sin URLs externas, sin `/api/*` y sin loops a callback.

## Roles y permisos

Autenticacion y autorizacion no se mezclan:

- Supabase Auth demuestra identidad.
- `authz.ts` decide si el email puede entrar, si el usuario esta activo y si existe registro de dominio.
- `admin-session.ts` resuelve rol/capabilities.
- RLS protege tablas Supabase por `auth.uid()` y membresia.

Roles base de organizacion:

- `owner`
- `admin`
- `member`

Capacidades administrativas existentes se conservan temporalmente desde Prisma/tabla de dominio.

## RLS

La migracion `supabase/migrations/20260710204000_recalc_admin_core.sql` habilita RLS y define politicas para:

- lectura/actualizacion de perfil propio;
- lectura de perfiles con organizacion compartida;
- lectura de organizaciones por membresia;
- administracion por `owner/admin`;
- acceso a archivos por metadata y membresia;
- acceso a inbox/training por organizacion;
- bloqueo de `migration_batches` a usuarios normales.

Principios:

- no se confia en `organization_id` enviado por cliente;
- membresia se valida con `auth.uid()`;
- funciones `security definer` evitan recursion en politicas;
- service role no participa en flujo normal de usuario.

## Variables requeridas

Publicas:

```bash
NEXT_PUBLIC_APP_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Server-only:

```bash
DATABASE_URL=
DIRECT_URL=
```

Opcional y solo servidor:

```bash
SUPABASE_SERVICE_ROLE_KEY=
```

Variables Neon Auth obsoletas en la ruta principal:

```bash
NEON_AUTH_BASE_URL
NEON_AUTH_COOKIE_SECRET
```

## Configuracion Supabase Auth

En Supabase staging:

1. Site URL: URL del Preview de Vercel o `http://127.0.0.1:3000` para local.
2. Redirect URLs:
   - `http://127.0.0.1:3000/auth/callback`
   - `https://<vercel-preview>/auth/callback`
   - subdominio staging si existe.
3. Email provider habilitado.
4. Google OAuth solo si se mantiene el boton `Continuar con Google`.
5. Passwordless OTP/magic link habilitado si se ofrecen en UI.
6. Phone OTP solo si el proyecto staging tiene proveedor SMS configurado.

## Cambios realizados

- `apps/web/src/lib/auth/server.ts`: reemplazado Neon Auth por Supabase Auth server-side.
- `apps/web/src/lib/auth/client.ts`: reemplazado Neon client por Supabase browser client.
- `apps/web/middleware.ts`: reemplazada deteccion heuristica de cookies por `auth.getClaims()`.
- `apps/web/src/app/(public)/auth/callback/route.ts`: nuevo callback SSR.
- Rutas `sign-in`/`sign-up`/admin/extension: eliminadas ramas Cloudflare/D1/Neon del flujo principal.
- `apps/web/src/app/globals.css`: removida importacion `@neondatabase/auth/ui/tailwind`.
- Dependencias: removidos `@neondatabase/auth` y `@neondatabase/neon-js`.

## Casos de prueba

| Caso | Estado local |
| --- | --- |
| Usuario no autenticado en `/admin` | Cubierto por middleware con claims |
| Usuario no autenticado en `/api/admin/*` | Cubierto por middleware con 401 |
| Email/password publico | Typecheck/lint; remoto pendiente |
| Email/password admin | Typecheck/lint; remoto pendiente |
| Magic link | Implementado; requiere email provider staging |
| OTP email | Implementado; requiere template OTP staging |
| Google OAuth | Implementado; requiere provider staging |
| Cierre de sesion | Implementado server action/API |
| Recuperacion de password | Implementado con recovery callback; remoto pendiente |
| Usuario sin organizacion | Debe validarse con seed staging |
| Usuario sin permisos | Debe validarse con seed staging |
| Administrador | Debe validarse con seed staging |
| RLS por organizacion | SQL preparado; requiere Supabase staging |

## Validaciones ejecutadas

| Validacion | Comando | Resultado |
| --- | --- | --- |
| TypeScript despues de migracion auth | `npm run typecheck` | OK |
| Lint despues de migracion auth | `npm run lint` | OK |

## Pendientes

- Ejecutar flujos reales contra Supabase staging.
- Actualizar o retirar paneles administrativos legacy `neon-auth`.
- Migrar servicios de diagnostico `neon_auth.user` a reportes Supabase Auth.
- Confirmar plantillas de email/OTP en Supabase staging.
- Validar que cookies SSR se refrescan correctamente en Vercel Preview.
