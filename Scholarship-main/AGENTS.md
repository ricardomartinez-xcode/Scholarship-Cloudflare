# AGENTS.md

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
