# Auditor/Reparador MVP

## Arquitectura encontrada

- App principal: `apps/web` con Next.js App Router, React 19 y TypeScript.
- Persistencia: Prisma sobre Neon/PostgreSQL usando schema `recalc_admin`.
- Auth: Neon Auth/Better Auth entra por `authz.ts`; el panel admin usa `admin-session.ts`.
- Permisos API: `requireAdminApiCapability` valida `AdminCapability`.
- Auditoria: `writeAdminAuditLog` registra acciones sensibles en `AdminAuditLog`.
- Rate limit: `checkRateLimit` usa Upstash REST si esta configurado y fallback local si no.
- GitHub: `admin-github-control.ts` concentra REST API con `GITHUB_TOKEN`, `GITHUB_OWNER` y `GITHUB_REPO`.
- Capacitacion/roleplay: ya existen `TrainingRoom`, `TrainingChat`, `TrainingMessage`, `TrainingFeedback` y permisos de sala para una fase posterior.

## Alcance PR 1

Este MVP agrega:

- `GET /api/agents/auditor/status`
- `POST /api/agents/auditor/diagnose`
- `POST /api/agents/auditor/repair-plan`
- `POST /api/agents/auditor/create-github-issue`
- `POST /api/agents/auditor/create-github-pr`
- UI admin en `/admin/operations/auditor`
- Libreria interna en `apps/web/src/lib/agents/auditor/**`

El diagnostico es read-only y no expone valores de secretos. Las acciones GitHub requieren owner. El PR de reparacion MVP solo genera documentos bajo `docs/agent-repairs/**`; no toca auth, Prisma, OAuth ni endpoints productivos.

## Variables nuevas

No hay variables nuevas obligatorias. Se reporta presencia/ausencia de:

- `GITHUB_TOKEN`, `GITHUB_OWNER`, `GITHUB_REPO`, `GITHUB_DEFAULT_BRANCH`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`
- `OPENAI_API_KEY`, `OPENAI_MODEL`
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
- `DATABASE_URL`, `DIRECT_URL`

## Como probar

```bash
npm run typecheck
npm run lint
npm test -- apps/web/src/lib/agents/auditor/__tests__/auditor-github.test.ts apps/web/src/lib/agents/auditor/__tests__/auditor-diagnostics.test.ts apps/web/src/app/api/agents/auditor/status/route.test.ts
npm run build
```

Browser:

- Entrar a `/admin/operations/auditor`.
- Ejecutar diagnostico.
- Confirmar que los hallazgos no muestran secretos.
- Con usuario owner y GitHub configurado, crear issue o PR draft desde un hallazgo repairable.

## Riesgos

- `diagnose` consulta tablas operativas; si la DB falla, devuelve hallazgos de error sin aplicar cambios.
- La deteccion estatica de rutas Google OAuth puede quedar `null` si el runtime no incluye fuentes TS.
- GitHub puede rechazar issue/PR por token sin scopes suficientes o rate limit.

## Rollback

Revertir el commit del PR. No hay migraciones ni cambios destructivos. Los PRs de reparacion generados pueden cerrarse sin merge.
