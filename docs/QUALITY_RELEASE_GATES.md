# Calidad, Observabilidad y Release

## Matriz crítica

| Flujo | Prioridad | Cobertura | Gate |
| --- | --- | --- | --- |
| Landing pública + auth pública | P0 | `tests/e2e/smoke.spec.ts`, `tests/e2e/visual-regression.spec.ts` | Obligatorio |
| Login usuario y calculadora | P0 | `tests/e2e/cost-flow.spec.ts`, `tests/e2e/keyboard-select.spec.ts`, `tests/e2e/responsive.spec.ts` | Obligatorio si hay credenciales |
| Login admin + shell admin | P0 | `tests/e2e/admin-ui.spec.ts`, `tests/e2e/admin-critical.spec.ts` | Obligatorio si hay credenciales |
| Invitaciones | P0 | `tests/e2e/admin-critical.spec.ts` | Obligatorio si hay credenciales |
| Importación de oferta (validar / aplicar / rollback) | P0 | `tests/e2e/admin-import.spec.ts` | Obligatorio si hay credenciales |
| Precios y beneficios | P1 | `tests/e2e/admin-critical.spec.ts` | Obligatorio si hay credenciales |
| PDFs y catálogo de programas | P1 | `tests/e2e/admin-critical.spec.ts`, `tests/e2e/cost-flow.spec.ts` | Obligatorio si hay credenciales |
| Comparación legacy vs canonical | P1 | logging + `/api/data/quote` compare mode | Informativo |

## Gate de release

Comando único:

```bash
npm run release:gate
```

El gate ejecuta, en orden:

1. `npx prisma generate`
2. `npx tsc --noEmit`
3. `npm run build`
4. `npx playwright test tests/e2e/smoke.spec.ts tests/e2e/visual-regression.spec.ts`
5. `npm run verify:neon` si existe conexión DB disponible
6. Suite autenticada si existen `E2E_EMAIL`, `E2E_PASSWORD`, `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD`

Para volver obligatoria la suite autenticada:

```bash
RELEASE_REQUIRE_AUTH_E2E=true npm run release:gate
```

## Observabilidad

- Logs estructurados: `src/lib/observability.ts`
- Errores y breadcrumbs opcionales: Sentry via `instrumentation.ts`, `instrumentation-client.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`
- Eventos de negocio persistidos: `recalc_admin.business_event`
- Health checks operativos:
  - `/api/admin/health`
  - `/api/admin/asset-health`

## Reglas de datos

- No registrar correos completos, tokens, secretos, cookies ni URLs con tokens en logs o breadcrumbs.
- No subir snapshots visuales con datos reales si no están enmascarados o provienen de pantallas públicas.
- Los eventos de negocio deben usar IDs internos y metadata sanitizada.
- `verify:neon` sólo debe correr contra el entorno correcto; nunca reutilizar URLs de otro ambiente.
- `verify:neon` debe validar no sólo los conteos legacy, sino también tablas canónicas, enum values y constraints del rollout activo.

## Entornos y secretos

| Grupo | Variables | Entornos | Owner sugerido | Notas |
| --- | --- | --- | --- | --- |
| Auth | `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET`, `ADMIN_EMAIL` | dev / preview / prod | App owner | Secretos separados por ambiente |
| Base de datos | `DATABASE_URL`, `DIRECT_URL` | dev / preview / prod | DB owner | No mezclar pooler y direct URL |
| Correo | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | preview / prod | Ops / Growth Ops | `SMTP_PASS` nunca compartido entre ambientes |
| Observabilidad | `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_ENVIRONMENT` | preview / prod | Platform | `NEXT_PUBLIC_SENTRY_DSN` sólo para cliente |
| Release / smoke | `NEXT_PUBLIC_BASE_URL`, `INVITE_BASE_URL`, `E2E_BASE_URL`, `E2E_EMAIL`, `E2E_PASSWORD`, `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD` | dev / preview | QA owner | No usar cuentas reales en screenshots |
| Integraciones | `ASSET_HEALTH_API_TOKEN`, `PROPOSAL_WEBHOOK_*` | preview / prod | Platform / Integrations | Webhooks por ambiente |

## Checklist mínimo antes de push de release

- `npm run release:gate`
- `npm run verify:neon` si hay acceso DB
- Health check operativo sin errores críticos
- No hay secretos de producción en `.env.local`
- La documentación del ambiente coincide con Vercel
