# Plan operativo post-merge de Scholarship

**Fecha:** 2026-03-12  
**Estado:** Referencia activa (roadmap post-merge)

## Objetivo general

Transformar la app en una plataforma más segura, clara, mantenible y escalable, conservando la lógica de negocio útil que ya existe.

## Principios de trabajo

- limpiar sin romper;
- documentar cada decisión;
- corregir primero lo que afecta seguridad y control;
- después consolidar arquitectura, UX y extensión;
- mantener compatibilidad gradual cuando eliminar de golpe implique riesgo.

## Estado actual consolidado

### Ya realizado

- Auditoría y baseline inicial.
- Limpieza inicial del repositorio.
- Saneamiento inicial de secretos y configuración.
- Endurecimiento del núcleo de seguridad y control administrativo.
- Gobernanza inicial de permisos y reorganización del admin.
- Merge de PRs previos ya confirmado.

### Riesgos identificados

- **Seguridad y control:** legado de `Role.ADMIN` con demasiado peso; mezcla entre rol global, overrides y membresías por organización; exposición innecesaria de lógica técnica/operativa; secretos embebidos en scripts históricos.
- **Permisos:** enforcement distribuido; naming confuso o inconsistente; falta de matriz real `capacidad -> pantalla -> acción -> validación`.
- **Panel administrativo:** mezcla de operación, configuración y tooling técnico.
- **Invitaciones:** flujo todavía poco claro en narrativas y estados.
- **Arquitectura y deuda técnica:** coexistencia legacy / compare / canonical; módulos con responsabilidad parcialmente solapada; scripts duplicados o casi duplicados.
- **UI/UX:** dark theme pesado en algunas superficies; tablas responsivas con avances pero sin patrón único; sistema de ubicaciones más cercano a zonas que a slots precisos.
- **Extensión Chrome:** no existe una base sólida y mantenible dentro del repo actual.

## Plan vigente por bloques

- **Bloque 1 — Auditoría, baseline, limpieza y saneamiento inicial:** avanzado / primera etapa ejecutada.
- **Bloque 2 — Seguridad y control administrativo:** encaminado y merged.
- **Bloque 3 — Gobernanza de permisos y reorganización del admin:** encaminado y merged.
- **Bloque 4 — Rediseño del flujo de invitaciones y consolidación estructural (prioridad inmediata):**
  - ricardomartinez-xcode/Scholarship#109 — [Bloque 4B] Modelar estados y ciclo de vida de invitaciones
  - ricardomartinez-xcode/Scholarship#108 — [Bloque 4A] Rediseñar flujo de /invite/accept
  - ricardomartinez-xcode/Scholarship#110 — [Bloque 4C] Consolidar rutas legacy, compare y canonical
  - ricardomartinez-xcode/Scholarship#111 — [Bloque 4D] Consolidar módulos solapados y scripts históricos duplicados
  - Orden sugerido: definir estados y transiciones → rediseñar el flujo visible → consolidar rutas coexistentes → limpiar módulos/scripts apoyados en la estructura nueva.
- **Bloque 5 — UI/UX admin, tablas responsivas y sistema progresivo de slots (posterior a bloque 4):**
  - ricardomartinez-xcode/Scholarship#112 — [Bloque 5A] Refinar UI/UX del panel administrativo
  - ricardomartinez-xcode/Scholarship#113 — [Bloque 5B] Mejorar dark theme y superficies visuales del admin
  - ricardomartinez-xcode/Scholarship#114 — [Bloque 5C] Unificar patrón de tablas y paneles responsivos
  - ricardomartinez-xcode/Scholarship#115 — [Bloque 5D] Introducir sistema progresivo de slots UI
  - Orden sugerido: limpiar jerarquía y claridad → refinar tema oscuro → unificar patrón responsive → introducir slots sobre base estable.
- **Bloque 6 — Extensión Chrome MV3 (posterior a bloque 5):**
  - ricardomartinez-xcode/Scholarship#116 — [Bloque 6A] Definir arquitectura base para extensión Chrome MV3
  - ricardomartinez-xcode/Scholarship#117 — [Bloque 6B] Implementar base técnica MV3 con side panel
  - ricardomartinez-xcode/Scholarship#118 — [Bloque 6C] Diseñar sincronización segura entre extensión y backend/sitio
  - ricardomartinez-xcode/Scholarship#119 — [Bloque 6D] Preparar base publicable y mantenible para extensión Chrome
  - Orden sugerido: delimitar arquitectura → montar base técnica → diseñar integración segura → preparar empaquetado/documentación.

## Secuencia recomendada

1. Ejecutar bloque 4: invitaciones + consolidación estructural.
2. Ejecutar bloque 5: UX/admin + tablas responsivas + slots progresivos.
3. Abrir bloque 6: extensión Chrome MV3.

## Validaciones por bloque

- Revisar navegación admin según rol/capacidad.
- Probar aceptación de invitaciones con distintos estados de sesión.
- Revisar tablas en móvil/tablet/escritorio.
- Verificar compatibilidad gradual de rutas legacy cuando aplique.
- Validar que scripts oficiales queden claros y documentados.

## Criterio operativo para los siguientes PRs

- No mezclar demasiados cambios de alto riesgo en un mismo PR.
- Priorizar primero control y seguridad.
- Luego consolidación estructural.
- Después UX y extensión.

## Resultado esperado

Mantener este roadmap como referencia única para la secuencia de implementación post-merge y trazabilidad de los bloques siguientes.
