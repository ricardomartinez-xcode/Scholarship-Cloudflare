# AGENTS.md

## Programa posterior a auditoria intranet

Antes de ejecutar cambios derivados de la auditoria, leer:
- `docs/audits/2026-05-24-monorepo-intranet-audit.md`

Prioridad de trabajo:
- P0: corregir release gate de GitHub, vulnerabilidades criticas/altas, `vercel-build` con `db push --accept-data-loss`, rate limiting productivo y manejo de tokens de extension.
- P1: cerrar residuos legacy por dominio, modularizar archivos grandes, deduplicar assets/extension y mejorar densidad de UI admin.
- P2: formalizar Figma/design tokens, crear tickets Linear y explorar asistentes internos solo despues de estabilizar seguridad y datos.

Guardrails para cambios derivados de la auditoria:
- No hacer deploy manual en Vercel si GitHub ya dispara deploy automatico, salvo instruccion explicita.
- No ejecutar migraciones destructivas ni `db push --accept-data-loss` contra ambientes compartidos o produccion.
- No leer, imprimir, versionar ni modificar `.env*`.
- No cambiar endpoints, contratos de datos, auth, Prisma o integraciones criticas sin justificarlo contra un hallazgo P0/P1 y validar el impacto.
- Hacer cambios pequenos por dominio y dejar pruebas enfocadas antes de eliminar codigo legacy.
- Si se toca UI, validar en browser local las rutas afectadas y revisar overflow, estados vacios y orden canonico.
- Si se toca CI/CD, verificar con GitHub Actions o reproducir el comando local equivalente.

Checklist minimo antes de cerrar una tarea:
- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run build`
- E2E o browser check de la superficie afectada cuando aplique.

## Objetivo
Portar únicamente UI/UX y base de arquitectura monorepo desde un diseño Lovable hacia este repo Next.js sin tocar backend ni integraciones críticas.

## No tocar
- prisma/**
- app/api/**
- lib/db/**
- lib/auth/**
- middleware.ts
- auth.ts
- integrations/google/**
- integrations/meta/**
- .env*
- config de deploy

## Sí tocar
- app/(dashboard)/**
- components/ui/**
- components/layout/**
- styles/**
- navegación y shells visuales
- apps/** (estructura monorepo)
- packages/** (paquetes base UI/config)
- docs/** (documentación técnica de migración)

## Reglas
- Preservar contratos de datos existentes.
- No cambiar nombres de endpoints.
- No migrar el proyecto fuera de Next.js App Router.
- No introducir cambios de lógica salvo que sean necesarios para conectar UI existente.
- En la fase foundation, priorizar cambios estructurales y de configuración antes que cambios funcionales.
- Cada cambio debe pasar lint y build.

## Comandos
- npm run lint
- npm run typecheck
- npm run build

## Nota de rama funcional
En la rama `rebuild/v2-functional-modules` se permite trabajo incremental de módulos funcionales backend/domain para auditoría, separación por dominios y documentación técnica sin migraciones destructivas.
