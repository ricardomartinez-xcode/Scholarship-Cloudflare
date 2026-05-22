# Plan Operativo Post-Merge para Scholarship

## Objetivo general

Transformar la app en una plataforma más segura, clara, mantenible y escalable, sin perder la lógica de negocio útil que ya existe.

## Principios de trabajo

- **Limpiar sin romper**: priorizar cambios incrementales y seguros
- **Documentar cada decisión**: mantener trazabilidad de cambios arquitectónicos
- **Corregir primero lo que afecta seguridad y control**: priorizar riesgos críticos
- **Después consolidar arquitectura, UX y extensión**: orden lógico de implementación
- **Mantener compatibilidad gradual**: cuando eliminar de golpe implique riesgo

---

## Estado actual consolidado

### ✅ Ya realizado

- Auditoría y baseline inicial
- Limpieza inicial del repositorio
- Saneamiento inicial de secretos y configuración
- Endurecimiento del núcleo de seguridad y control administrativo
- Gobernanza inicial de permisos y reorganización del admin
- Merge de PRs previos ya confirmado
- Permission enforcement matrix (#106)
- Admin navigation domain grouping (#106)
- Capability alias normalization (#106)

### ⚠️ Riesgos identificados

#### Seguridad y control
- Legado de `Role.ADMIN` con demasiado peso
- Mezcla entre rol global, overrides y membresías por organización
- Exposición innecesaria de lógica técnica/operativa
- Secretos embebidos en scripts históricos

#### Permisos
- Enforcement distribuido
- Naming confuso o inconsistente
- Falta de matriz real `capacidad → pantalla → acción → validación`
- **Parcialmente resuelto**: matriz de permisos implementada en #106

#### Panel administrativo
- Mezcla de operación, configuración y tooling técnico
- **Parcialmente resuelto**: organización por dominios implementada en #106

#### Invitaciones
- Flujo todavía poco claro en narrativas y estados
- Diferenciación de casos (usuario nuevo, autenticado correcto, autenticado con email incorrecto) necesita clarificación

#### Arquitectura y deuda técnica
- Coexistencia legacy / compare / canonical
- Módulos con responsabilidad parcialmente solapada
- Scripts duplicados o casi duplicados

#### UI/UX
- Dark theme pesado en algunas superficies
- Tablas responsivas con avances pero sin patrón único
- Sistema de ubicaciones más cercano a zonas que a slots precisos

#### Extensión Chrome
- No existe una base sólida y mantenible dentro del repo actual

---

## Plan vigente por bloques

### Bloque 1 — Auditoría, baseline, limpieza y saneamiento inicial
**Estado**: ✅ Avanzado / primera etapa ejecutada

### Bloque 2 — Seguridad y control administrativo
**Estado**: ✅ Encaminado y merged

### Bloque 3 — Gobernanza de permisos y reorganización del admin
**Estado**: ✅ Encaminado y merged (#106)

### Bloque 4 — Rediseño del flujo de invitaciones y consolidación estructural
**Estado**: 🎯 **SIGUIENTE PRIORIDAD INMEDIATA**

#### Alcance del bloque 4

##### Invitaciones
- Rediseño más claro de `/invite/accept`
- Diferenciación de casos:
  - Usuario nuevo
  - Usuario autenticado correcto
  - Usuario autenticado con email incorrecto
- Clarificación del ciclo de vida de invitaciones

##### Consolidación estructural
- Consolidación de rutas legacy/canonical
- Clarificación de módulos solapados
- Consolidación de scripts históricos duplicados

#### Issues del bloque 4

| Issue | Título | Orden |
|-------|--------|-------|
| [#109](https://github.com/ricardomartinez-xcode/Scholarship/issues/109) | [Bloque 4B] Modelar estados y ciclo de vida de invitaciones | 1º |
| [#108](https://github.com/ricardomartinez-xcode/Scholarship/issues/108) | [Bloque 4A] Rediseñar flujo de /invite/accept | 2º |
| [#110](https://github.com/ricardomartinez-xcode/Scholarship/issues/110) | [Bloque 4C] Consolidar rutas legacy, compare y canonical | 3º |
| [#111](https://github.com/ricardomartinez-xcode/Scholarship/issues/111) | [Bloque 4D] Consolidar módulos solapados y scripts históricos duplicados | 4º |

#### Orden sugerido y motivo

1. **#109 - Modelar estados y ciclo de vida** → Primero definir estados y transiciones
2. **#108 - Rediseñar flujo de /invite/accept** → Después rediseñar el flujo visible
3. **#110 - Consolidar rutas** → Luego consolidar rutas coexistentes
4. **#111 - Consolidar módulos/scripts** → Finalmente limpiar módulos/scripts con estructura clara

---

### Bloque 5 — UI/UX admin, tablas responsivas y sistema progresivo de slots
**Estado**: 📋 Siguiente prioridad después del bloque 4

#### Alcance del bloque 5

- Refinamiento visual del admin
- Mejora del dark theme
- Patrón único de tablas y paneles responsivos
- Introducción progresiva de un sistema de slots basado en:
  - `page`
  - `section`
  - `panel`
  - `slot`
  - `breakpoint`
  - `order`
  - `visibility_rule`

#### Issues del bloque 5

| Issue | Título | Orden |
|-------|--------|-------|
| [#112](https://github.com/ricardomartinez-xcode/Scholarship/issues/112) | [Bloque 5A] Refinar UI/UX del panel administrativo | 1º |
| [#113](https://github.com/ricardomartinez-xcode/Scholarship/issues/113) | [Bloque 5B] Mejorar dark theme y superficies visuales del admin | 2º |
| [#114](https://github.com/ricardomartinez-xcode/Scholarship/issues/114) | [Bloque 5C] Unificar patrón de tablas y paneles responsivos | 3º |
| [#115](https://github.com/ricardomartinez-xcode/Scholarship/issues/115) | [Bloque 5D] Introducir sistema progresivo de slots UI | 4º |

#### Orden sugerido y motivo

1. **#112 - Refinar UI/UX** → Primero limpiar jerarquía y claridad general del admin
2. **#113 - Mejorar dark theme** → Después refinar el tema visual oscuro
3. **#114 - Unificar patrón responsive** → Luego unificar el patrón en componentes críticos
4. **#115 - Sistema de slots** → Finalmente introducir slots sobre base visual estable

---

### Bloque 6 — Extensión Chrome MV3
**Estado**: 📅 Posterior a bloques 4 y 5

#### Alcance del bloque 6

- Manifest V3
- Side panel como superficie principal
- Sincronización con backend/sitio
- Eliminación de acceso directo al admin
- Base publicable y mantenible

#### Issues del bloque 6

| Issue | Título | Orden |
|-------|--------|-------|
| [#116](https://github.com/ricardomartinez-xcode/Scholarship/issues/116) | [Bloque 6A] Definir arquitectura base para extensión Chrome MV3 | 1º |
| [#117](https://github.com/ricardomartinez-xcode/Scholarship/issues/117) | [Bloque 6B] Implementar base técnica MV3 con side panel | 2º |
| [#118](https://github.com/ricardomartinez-xcode/Scholarship/issues/118) | [Bloque 6C] Diseñar sincronización segura entre extensión y backend/sitio | 3º |
| [#119](https://github.com/ricardomartinez-xcode/Scholarship/issues/119) | [Bloque 6D] Preparar base publicable y mantenible para extensión Chrome | 4º |

#### Orden sugerido y motivo

1. **#116 - Arquitectura base** → Primero delimitar arquitectura y responsabilidades
2. **#117 - Base técnica MV3** → Después montar la base técnica MV3
3. **#118 - Sincronización segura** → Luego diseñar integración segura con backend/sitio
4. **#119 - Base publicable** → Finalmente preparar empaquetado, documentación y base publicable

---

## Secuencia de ejecución recomendada

```
Bloque 4 (Invitaciones + Consolidación)
  ├─ #109 → Modelar estados de invitaciones
  ├─ #108 → Rediseñar /invite/accept
  ├─ #110 → Consolidar rutas legacy/canonical
  └─ #111 → Consolidar módulos y scripts
           ↓
Bloque 5 (UI/UX + Responsive + Slots)
  ├─ #112 → Refinar UI/UX admin
  ├─ #113 → Mejorar dark theme
  ├─ #114 → Unificar patrón responsive
  └─ #115 → Sistema progresivo de slots
           ↓
Bloque 6 (Extensión Chrome MV3)
  ├─ #116 → Arquitectura base MV3
  ├─ #117 → Base técnica con side panel
  ├─ #118 → Sincronización segura
  └─ #119 → Base publicable
```

---

## Validaciones por bloque

### Bloque 4 - Invitaciones y consolidación
- ✅ Revisar navegación admin según rol/capacidad (ya mejorado en #106)
- [ ] Probar aceptación de invitaciones con distintos estados de sesión
- [ ] Verificar compatibilidad gradual de rutas legacy cuando aplique
- [ ] Validar que scripts oficiales queden claros y documentados

### Bloque 5 - UI/UX y responsive
- [ ] Revisar tablas en móvil/tablet/escritorio
- [ ] Validar contraste y legibilidad del dark theme
- [ ] Verificar patrón responsive en componentes críticos
- [ ] Probar sistema de slots en superficies seleccionadas

### Bloque 6 - Extensión Chrome
- [ ] Verificar carga de extensión en modo desarrollo
- [ ] Probar side panel y flujo de autenticación
- [ ] Validar sincronización con backend
- [ ] Revisar permisos y configuración de publicación

---

## Criterio operativo para los siguientes PRs

### Principios de gestión de PRs

1. **No mezclar demasiados cambios de alto riesgo en un mismo PR**
   - Mantener PRs focalizados en un objetivo específico
   - Separar cambios de seguridad de cambios de UX

2. **Priorizar primero control y seguridad**
   - Validar impacto en autenticación y autorización
   - Revisar exposición de datos sensibles

3. **Luego consolidación estructural**
   - Reducir deuda técnica progresivamente
   - Documentar decisiones arquitectónicas

4. **Después UX y extensión**
   - Mejorar experiencia sobre base estable
   - Introducir nuevas funcionalidades sobre arquitectura consolidada

### Checklist pre-merge

- [ ] Tests de regresión ejecutados
- [ ] Documentación actualizada
- [ ] Cambios de seguridad validados
- [ ] Compatibilidad gradual verificada
- [ ] Code review completado
- [ ] CI/CD passing

---

## Contexto técnico actual

### Arquitectura
- **Framework**: Next.js 16.1.6 (App Router)
- **Database**: PostgreSQL (Neon) con Prisma 6.19.2
- **Auth**: Neon Auth (Better Auth)
- **UI**: Tailwind CSS 4 + Radix UI
- **Testing**: Playwright e2e

### Sistema de permisos (implementado en #106)
- **AdminCapability**: 17 capacidades granulares
- **ADMIN_PERMISSION_MATRIX**: Mapeo capacidad → módulo → rutas → acciones → validaciones
- **ADMIN_ROUTE_GUARDS**: Guards de ruta con lógica requiredAll/requiredAny
- **Capability aliases**: Normalización de typos conocidos

### Flujo de invitaciones actual
- **Creación**: `src/lib/invites.ts` - Generación de token, email, TTL de 7 días
- **Aceptación**: `src/app/(public)/invite/accept/page.tsx` - Validación y redirect
- **API**: `src/app/api/invite/accept/route.ts` - Consumo de token con rate limiting
- **Estados conocidos**: pending, used, expired

### Rutas y modos
- **RuntimeMode**: "legacy" | "compare" | "canonical"
- **Variables de entorno**: `PRICING_READ_MODE`, `DIRECTORY_READ_MODE`, `DIRECTORY_WRITE_MODE`, `QUOTE_MODE`
- **Objetivo**: Consolidar hacia modo canonical

### Admin UI
- **Dominios de navegación** (implementados en #106):
  - Operación (benefits, prices, oferta, invitations)
  - Contenido (comunicados, whatsapp-templates, ctas, sidebar)
  - Usuarios y acceso (users, organizations)
  - UNIDEP (fees, directory, programs, campuses)
  - Desarrollo (reporting, audit, auth-sync)

---

## Recursos y referencias

### Documentación del proyecto
- [`docs/ADMIN_PERMISSIONS.md`](../docs/ADMIN_PERMISSIONS.md) - Referencia de permisos
- [`docs/ROUTING_MODES_REFERENCE.md`](../docs/ROUTING_MODES_REFERENCE.md) - Modos de runtime
- [`docs/SCRIPTS_INVENTORY.md`](../docs/SCRIPTS_INVENTORY.md) - Inventario de scripts
- [`docs/AUTOMATED_CODE_REVIEW.md`](../docs/AUTOMATED_CODE_REVIEW.md) - Sistema de code review

### Issues de referencia
- [#107](https://github.com/ricardomartinez-xcode/Scholarship/issues/107) - Este roadmap (issue principal)
- [#106](https://github.com/ricardomartinez-xcode/Scholarship/pull/106) - Permission enforcement matrix (merged)

### Scripts operativos
- `npm run dev` - Servidor de desarrollo
- `npm run build` - Build de producción
- `npm run release:gate` - Gate de calidad pre-release
- `./scripts/local-code-review.sh` - Code review local

---

## Resultado esperado

Mantener este documento como referencia operativa del roadmap para:

1. **Trazabilidad**: Punto único de seguimiento post-merge
2. **Priorización**: Secuencia clara de implementación
3. **Validación**: Criterios de aceptación por bloque
4. **Comunicación**: Referencia compartida para el equipo

---

## Versionado del plan

| Versión | Fecha | Cambios |
|---------|-------|---------|
| 1.0 | 2026-03-12 | Consolidación inicial del roadmap desde issue #107 |

---

**Última actualización**: 2026-03-12
**Issue de referencia**: [#107](https://github.com/ricardomartinez-xcode/Scholarship/issues/107)
**Estado actual**: Bloque 4 (siguiente prioridad inmediata)
