# Roadmap Quick Reference

Referencia rápida del plan operativo post-merge.

📖 **Documento completo**: [`OPERATIONAL_ROADMAP.md`](./OPERATIONAL_ROADMAP.md)

---

## Estado actual

✅ **Completado**: Bloques 1, 2, 3 (seguridad, permisos, admin nav)
🎯 **Actual**: Bloque 4 (invitaciones + consolidación estructural)
📋 **Próximo**: Bloque 5 (UI/UX + responsive + slots)
📅 **Futuro**: Bloque 6 (extensión Chrome MV3)

---

## Bloque 4 — Invitaciones y consolidación 🎯

**Orden de ejecución**:

1. [#109](https://github.com/ricardomartinez-xcode/Scholarship/issues/109) — Modelar estados y ciclo de vida de invitaciones
2. [#108](https://github.com/ricardomartinez-xcode/Scholarship/issues/108) — Rediseñar flujo de /invite/accept
3. [#110](https://github.com/ricardomartinez-xcode/Scholarship/issues/110) — Consolidar rutas legacy, compare y canonical
4. [#111](https://github.com/ricardomartinez-xcode/Scholarship/issues/111) — Consolidar módulos solapados y scripts históricos

**Razón del orden**: Estados → Flujo → Rutas → Scripts

---

## Bloque 5 — UI/UX y responsive 📋

**Orden de ejecución**:

1. [#112](https://github.com/ricardomartinez-xcode/Scholarship/issues/112) — Refinar UI/UX del panel administrativo
2. [#113](https://github.com/ricardomartinez-xcode/Scholarship/issues/113) — Mejorar dark theme y superficies visuales
3. [#114](https://github.com/ricardomartinez-xcode/Scholarship/issues/114) — Unificar patrón de tablas y paneles responsivos
4. [#115](https://github.com/ricardomartinez-xcode/Scholarship/issues/115) — Introducir sistema progresivo de slots UI

**Razón del orden**: Jerarquía → Tema → Responsive → Slots

---

## Bloque 6 — Extensión Chrome MV3 📅

**Orden de ejecución**:

1. [#116](https://github.com/ricardomartinez-xcode/Scholarship/issues/116) — Definir arquitectura base para extensión Chrome MV3
2. [#117](https://github.com/ricardomartinez-xcode/Scholarship/issues/117) — Implementar base técnica MV3 con side panel
3. [#118](https://github.com/ricardomartinez-xcode/Scholarship/issues/118) — Diseñar sincronización segura entre extensión y backend/sitio
4. [#119](https://github.com/ricardomartinez-xcode/Scholarship/issues/119) — Preparar base publicable y mantenible

**Razón del orden**: Arquitectura → Técnica → Sincronización → Publicación

---

## Principios operativos

1. **Limpiar sin romper** — Cambios incrementales y seguros
2. **Documentar cada decisión** — Trazabilidad de cambios arquitectónicos
3. **Seguridad primero** — Priorizar riesgos críticos
4. **Compatibilidad gradual** — Cuando eliminar de golpe implique riesgo
5. **PRs focalizados** — No mezclar demasiados cambios de alto riesgo

---

## Checklist pre-merge

- [ ] Tests de regresión ejecutados
- [ ] Documentación actualizada
- [ ] Cambios de seguridad validados
- [ ] Compatibilidad gradual verificada
- [ ] Code review completado
- [ ] CI/CD passing

---

## Archivos clave por bloque

### Bloque 4 - Invitaciones
- `src/lib/invites.ts` — Core invite logic
- `src/app/(public)/invite/accept/page.tsx` — Accept UI
- `src/app/api/invite/accept/route.ts` — Accept endpoint

### Bloque 4 - Consolidación
- `src/lib/legacy-pricing.ts` — Legacy system
- `src/lib/canonical-pricing-readers.ts` — Canonical system
- `src/lib/runtime-comparison.ts` — Comparison logic
- `scripts/` — Scripts históricos

### Bloque 5 - UI/UX
- `src/components/admin/AdminChrome.tsx` — Main admin layout
- `src/components/admin/*Client.tsx` — Admin tables
- `src/app/globals.css` — Theme variables

### Bloque 6 - Extensión
- _No existe actualmente_ — Se creará desde cero

---

## Comandos útiles

```bash
# Desarrollo
npm run dev

# Build
npm run build

# Quality gate
npm run release:gate

# Code review local
./scripts/local-code-review.sh
```

---

**Issue principal**: [#107](https://github.com/ricardomartinez-xcode/Scholarship/issues/107)
**Última actualización**: 2026-03-12
