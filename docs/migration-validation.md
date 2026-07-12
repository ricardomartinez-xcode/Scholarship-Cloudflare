# Validacion de migracion Vercel + Supabase

Fecha: 2026-07-12  
Rama: `migration/vercel-supabase`  
Preview: `https://scholarship-git-migration-vercel-supabase-re-lead.vercel.app`

## Alcance

La validacion uso Vercel Preview y el proyecto Supabase staging
`eocpoygtcetjieglkxnt`. Cloudflare produccion, D1, R2, DNS y el dominio
productivo no fueron modificados.

Antes de aplicar SQL se genero un respaldo de esquema local de 25,503 bytes con
SHA-256 `ecbce2727ecd948b708a974487126dc1248ee3bcd89c21d97a2228df28521c56`.

## Validaciones obligatorias

| Validacion | Comando | Resultado | Evidencia |
| --- | --- | --- | --- |
| Install | `npm ci --foreground-scripts` | Pasa | `7:04.76`, Prisma Client generado, 0 vulnerabilidades |
| Lint | `npm run lint` | Pasa | `1:17.80`, 0 warnings permitidos |
| Typecheck | `npm run typecheck` | Pasa | `46.03 s` |
| Tests | `npm test -- --reporter=dot` | Pasa | 103 archivos, 400 pruebas, `41.93 s` |
| Build | `npm run build` | Pasa | Next 16.2.6, 16/16 paginas, `5:31.76` |
| Start | `next start --hostname 127.0.0.1 --port 3001` | Pasa | Ready en 404 ms |
| Smoke local | Playwright sobre `127.0.0.1:3001` | Pasa | landing/login 1/1, sin error del servidor |

La primera suite Vitest ejecutada en paralelo con lint tuvo un timeout de 15 s
al importar `recalc-public-control-api`: 102 archivos y 396 pruebas pasaron. La
prueba aislada paso en 1.63 s y la suite completa secuencial paso; se
clasifica como saturacion local, no como regresion funcional.

## Seguridad del diff

- `npm audit --audit-level=high --omit=dev`: 0 vulnerabilidades;
- busqueda de tokens, service keys, private keys y connection strings: sin
  secretos reales versionados; solo placeholders de pruebas/documentacion;
- `SUPABASE_SERVICE_ROLE_KEY` permanece en modulos `server-only`;
- RLS no se desactiva y no existen grants nuevos a `anon`;
- se retiro el correo completo de logs/excepciones del flujo de importacion;
- el parser XLSX limita upload a 10 MB, 2,048 entradas ZIP y 64 MB
  descomprimidos; el endpoint responde `413` antes de leer uploads excedidos;
- pruebas de hardening: 9/9 enfocadas y suite completa 400/400.

## Supabase PostgreSQL

| Caso | Resultado |
| --- | --- |
| Migraciones | 11 versiones remotas alineadas hasta `20260712204500` |
| Esquema | 76 tablas; RLS activo en 76; 23 politicas |
| Seed | 25 planteles: 24 fisicos y `ONLINE` |
| Foreign keys/constraints | Aplicadas y verificadas por importacion/rollback |
| Aislamiento | Lectura propia permitida; organizacion ajena devuelve 0 o `42501` |
| Escritura | Importacion C1 creo 35 programas y 172 ofertas en una transaccion |
| Rollback | Sesion marcada `rolled_back`; ofertas 172 -> 0 |

La migracion de privilegios de `service_role` se detecto durante la limpieza,
se versiono, probo y aplico en staging. No concede acceso a `anon` ni desactiva
RLS.

## Auth y autorizacion

- usuario no autenticado: rutas protegidas redirigen a sign-in;
- email/password: login publico y administrativo correctos;
- recuperacion de sesion: la cookie SSR sobrevivio recarga del Preview;
- logout: redireccion a `/` y nuevo acceso a `/unidep` bloqueado;
- administrador: acceso al panel/importacion/rollback permitido;
- usuario externo: datos de la otra organizacion bloqueados;
- `service_role`: usado solo en scripts/operaciones server-side de staging.

Playwright de Auth sobre Preview: 3/3 pruebas. Magic link, OTP, recovery email y
Google OAuth no se ejecutaron porque requieren configuracion de proveedores y
correo de staging separada.

## Realtime

- publication: `inbox_message`, `inbox_messages`, `TrainingMessage` y
  `training_messages`;
- INSERT, UPDATE y DELETE recibidos por `postgres_changes`;
- filtro por organizacion/recurso validado;
- listener removido al desmontar;
- un evento antes y otro despues de reconexion, sin duplicados;
- navegador del Preview conectado por WebSocket al host Supabase correcto;
- 0 errores de consola, pagina o respuestas fallidas en la verificacion final.

Presence con dos navegadores simultaneos no se ejecuto.

## Storage

| Caso | Resultado |
| --- | --- |
| Upload permitido | Pasa |
| MIME invalido | Rechazado |
| Signed URL/download | Pasa; descarga de 12 bytes |
| Acceso cruzado | Bloqueado por organizacion/RLS |
| Delete | Objeto y metadata eliminados |
| Ruta aplicacion | presign 200, upload 200, complete 200, signed-view 307 |
| Limites bucket | privado, 50 MB, 10 MIME permitidos |

No se ejecuto una copia R2 -> Storage: no se uso acceso R2 productivo ni se
proporciono un manifiesto staging aprobado.

## Admin, importacion y cotizador

Se uso el archivo real `docs/Oferta Acade#U0301mica.xlsx`:

- 26 hojas procesadas; Online y 24 planteles reconocidos;
- se eligieron bloques C1/C2/C3 vigentes y se ignoraron comparativos historicos;
- preview: 172 filas, 0 warnings;
- modulos: 53 longitudinales y 119 modulares;
- publicacion: 35 programas y 172 ofertas C1;
- el cotizador mostro ciclo, linea, modalidad, programa, plantel y horario;
- rollback desde el panel restaurado y verificado;
- UI desktop 1440 px y mobile 390 px sin overflow horizontal ni H1 duplicado.

El calculo monetario no se aprueba: staging no contiene archivos/datos reales de
precios y beneficios. La UI informa `Sin precio para este plantel` y solicita
completar plan de pago. No se inventaron tarifas.

## Limpieza staging

Despues de las pruebas se eliminaron por UUID exacto usuarios Auth/dominio,
organizaciones, membresias, mensajes, salas, sesion de importacion, auditorias,
versiones, objetos y metadata temporales.

Estado final: 25 planteles, 0 programas, 0 ofertas, 0 fixtures de Auth/RLS,
0 objetos y 0 metadata de prueba.

## Validaciones no realizadas

- migracion de datos productivos D1 -> PostgreSQL;
- migracion de objetos productivos R2 -> Storage;
- calculo monetario con tarifas/beneficios reales;
- email delivery para magic link/OTP/recovery y Google OAuth;
- Presence con dos sesiones simultaneas;
- promocion Vercel Production, DNS o dominio productivo.

Estas pruebas no se marcan como aprobadas.
