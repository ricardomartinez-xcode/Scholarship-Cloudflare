# Reparacion propuesta: Estado de rutas Google OAuth

Generado: 2026-06-05T21:22:18.662Z
Finding: `oauth.google.routes.state`
Modulo: `oauth`
Severidad: `warning`

## Resumen

Las rutas Google OAuth estan deshabilitadas temporalmente.

## Accion sugerida

Crear plan de reactivacion con access_type=offline, conservacion de refresh token y manejo invalid_grant.

## Impacto

medium

## Riesgo

medium

## Archivos permitidos

- `docs/agent-repairs/oauth-google-routes-state.md`

## Pruebas sugeridas

- `npm run typecheck`
- `npm run lint`
- `npm test -- apps/web/src/lib/agents/auditor/__tests__/auditor-github.test.ts apps/web/src/lib/agents/auditor/__tests__/auditor-diagnostics.test.ts`
- `npm run build`

## Rollback

Cerrar el PR generado o revertir el commit de documentacion de reparacion.

## Evidencia sanitizada

```json
{
  "connectDisabled": true,
  "callbackDisabled": true,
  "valuesExposed": false
}
```
