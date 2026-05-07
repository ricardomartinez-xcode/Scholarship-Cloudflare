# Campus institucional foundation implementation

## Objetivo
Aplicar el spec aprobado de Campus institucional como primera capa UI/UX del monorepo, sin tocar backend, autenticacion, endpoints, integraciones criticas ni configuracion de deploy.

## Alcance
- Alinear tokens compartidos de color, radio, sombras y superficies.
- Actualizar primitivas base de `packages/ui` manteniendo sus APIs actuales.
- Rehacer la landing publica con una lectura mas comercial, limpia y funcional.
- Agregar overrides globales para shell, tarjetas, controles, tablas y estados administrativos.
- Verificar con lint, typecheck, build y revision visual local.

## Fuera de alcance
- Cambios a `prisma/**`, `app/api/**`, `lib/db/**`, `lib/auth/**`, `middleware.ts`, `auth.ts`, `.env*` o deploy.
- Cambios de contratos de datos o nombres de endpoints.
- Migracion fuera de Next.js App Router.

## Pasos
1. Crear/actualizar tokens foundation con la paleta Campus institucional aprobada.
2. Reorganizar primitivas visuales para radios de 6-8px, superficies blancas, azul institucional y verde contextual.
3. Actualizar landing publica removiendo decoracion innecesaria, emojis como iconos primarios y tarjetas demasiado redondeadas.
4. Anadir una capa global final de foundation para que shell, admin, tablas, controles y cards hereden el nuevo sistema visual.
5. Ejecutar verificacion completa y corregir regresiones dentro del alcance permitido.

