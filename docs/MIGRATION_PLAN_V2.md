# MIGRATION_PLAN_V2

## Estrategia
Migración progresiva en olas para evitar regresiones en auth, prisma, cotización y rutas críticas.

## Fase 1 (esta rama: `rebuild/v2-foundation`)
- [x] Crear workspaces npm (`apps/*`, `packages/*`).
- [x] Preparar `apps/web` como contenedor de estructura objetivo.
- [x] Crear paquetes base: `ui`, `config`, `db`, `auth`, `domain`, `realtime`.
- [x] Añadir alias TypeScript para paquetes.
- [x] Documentar arquitectura, plan y validación.
- [x] Mantener la app actual funcional sin mover backend/integraciones.

## Fase 2 (sugerida)
- [ ] Mover gradualmente componentes presentacionales de `src/components` hacia `packages/ui`.
- [ ] Introducir adaptadores en `apps/web/src/components` para consumo incremental.
- [ ] Migrar estilos de shell/layout a módulos más pequeños (sin tocar lógica).

## Fase 3 (sugerida)
- [ ] Reubicar rutas App Router de `src/app` a `apps/web/src/app` por grupos:
  1. público,
  2. auth,
  3. app autenticada,
  4. admin.
- [ ] Mantener redirects y compatibilidad de paths.

## Fase 4 (sugerida)
- [ ] Consolidar pruebas (Vitest/Playwright) apuntando al workspace `@relead/web`.
- [ ] Endurecer CI para `lint`, `typecheck` y `build` por workspace.

## Riesgos
- Cambios de rutas de importación y resolución TS si se mueve código demasiado rápido.
- Acoplamiento actual entre layouts y utilidades de negocio.
- Complejidad de `globals.css` en responsive si no se modulariza por etapas.

## Criterio de avance
Avanzar solo cuando cada ola cierre con `typecheck`, `lint` y `build` en verde o con incidencias documentadas.
