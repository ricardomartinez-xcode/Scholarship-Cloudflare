# Runbook de corte Cloudflare

Este runbook protege el despliegue de `Scholarship-Cloudflare` mientras se sustituyen dependencias de Neon, Prisma y Supabase por Cloudflare Workers, D1, R2, Queues y Durable Objects.

## Principios operativos

1. Ningún merge debe aplicar migraciones D1 automáticamente.
2. Un despliegue de producción sólo puede ocurrir después de una validación de calidad exitosa.
3. Las migraciones D1 se aplican manualmente, con una confirmación separada y evidencia de preflight.
4. Los cambios de esquema, datos y runtime se publican en PRs independientes.
5. Una falla de CI o de despliegue bloquea promoción y no se compensa con reintentos ciegos.

## Fase 0 — Controles de despliegue

- Revisar y fusionar el PR de seguridad del workflow Cloudflare.
- Ejecutar el workflow manual **Cloudflare Preflight** contra `main`.
- Conservar el resultado del preflight como evidencia del corte.

El preflight realiza exclusivamente operaciones de lectura o compilación:

```bash
npm run build:cloudflare
npm run d1:migrations:list
npm run d1:tables
```

No publica el Worker ni aplica SQL remoto.

## Fase 1 — Diagnóstico de baseline

Antes de un despliegue:

1. Resolver el log exacto del último `quality-release-gate` fallido.
2. Resolver el log exacto del último `Deploy Cloudflare Worker` fallido.
3. Repetir el preflight y registrar:
   - versión de Wrangler autenticada;
   - resultado del bundle OpenNext;
   - migraciones D1 pendientes;
   - tablas D1 visibles.
4. Confirmar que no queden secretos o scripts de sincronización hacia Neon/Postgres en el workflow de deploy.

## Fase 2 — Esquema D1

Para cada lote de migraciones:

1. Ejecutar preflight exitoso.
2. Revisar el diff de SQL y el plan de reversión.
3. Crear una evidencia de respaldo/recuperación antes de aplicar cambios irreversibles.
4. Ejecutar un deploy manual con `apply_d1_migrations=true` y la confirmación requerida.
5. Volver a ejecutar `npm run d1:migrations:list` y `npm run d1:tables`.

Las migraciones son versionadas y deben permanecer en `apps/web/migrations/`.

## Fase 3 — Runtime Worker

Orden de migración recomendado:

1. Lecturas administrativas D1.
2. Mutaciones administrativas D1 con auditoría.
3. Autenticación y control de abuso nativos de Cloudflare.
4. Google OAuth con PKCE, tokens cifrados y D1.
5. Outbox D1, luego Queue y Durable Object para entrega realtime.
6. Importaciones R2/Queue y operaciones largas.

No habilitar rutas de negocio que dependan de tablas, bindings o consumidores no aprovisionados.

## Fase 4 — Observabilidad y salud

- Configurar un target allowlisted de salud en `cf-ops` para el endpoint público de producción cuando exista una URL aprobada.
- Generar un reporte de observabilidad desde `cf-ops` tras cada promoción.
- Verificar el endpoint `/api/admin/health` desde una sesión autorizada y un healthcheck público separado si se habilita.

## Bloqueos actuales

- El contrato de `cf-ops` para `migration.checklist.upsert` solicita `checklistId`, pero su Action no expone ese campo; debe corregirse antes de registrar el checklist en el control plane.
- El conector de GitHub disponible no expone logs de steps de Actions; la persona operadora debe consultar los logs del run fallido antes de reintentar o promover.
- Entrega realtime completa requiere bindings de Queue y Durable Objects; la outbox D1 no sustituye por sí sola un WebSocket.

## Criterios de promoción

Una versión puede promoverse a producción únicamente cuando se cumpla todo lo siguiente:

- PR revisado y CI verde.
- Preflight Cloudflare verde.
- No hay migraciones inesperadas pendientes.
- El bundle OpenNext se construye correctamente.
- El rollback de Worker y el plan de recuperación D1 están documentados.
- Healthcheck y observabilidad muestran estado estable.
