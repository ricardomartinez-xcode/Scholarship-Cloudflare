# Push Log

Template:
- Date: YYYY-MM-DD
- Branch: development
- Impact: low | medium | high
- Category: release-x.y.z | hotfix-x.y.z | feature-x.y.z | chore-x.y.z
- Commit: <short SHA>
- Summary: <short summary>

---

## Commits de referencia

| Pregunta | Commit | Fecha | Descripción |
|---|---|---|---|
| ¿Cuándo se comenzó a implementar la migración a Prisma? | `7e0e826` | 2026-02-19 | Primer commit en git: introduce `prisma/schema.prisma`, `src/lib/prisma.ts` y migración `20260209_baseline` (la migración fue creada el 2026-02-09 pero el historial pre-git se consolidó y empujó el 2026-02-19 como commit inicial). |
| ¿Cuál es el commit de limpieza del repositorio (archivos)? | `cf801ef`…`a6508b9` | 2026-02-24 | Serie de commits que eliminan archivos obsoletos: `branding/layout-logo-temp.svg`, `branding/logo-recalc.png`, iconos legacy (`icon128`, `icon16`, `icon32`, `icon48`, `logo_Recalc.PNG`). |
| ¿Cuál es el commit de limpieza del código (code review)? | `683b339` (#45) | 2026-03-03 | Primer commit de code-review cleanup: elimina `react-router-dom`, mueve deps a devDependencies, crea `normalizeEmail` compartido, mejora type-safety en `authz.ts`. Continuado en `013c14e` (#46). |
| ¿Cuál es la versión antes de estos commits? | — | 2026-02-05 | **3.1.1** — última versión estable antes de release-3.2.0, que es el ciclo donde se hizo setup de Prisma y la limpieza de archivos estáticos. |

---
- Date: 2026-02-03
- Branch: development
- Impact: medium
- Category: recuperacion-2.1.1
- Summary: base recuperada (app-real + reglas agente + logos)
- Date: 2026-02-03
- Branch: development
- Impact: high
- Category: Integracion-2.2.1
- Summary: integra neon auth + db + gate dominio
- Date: 2026-02-03
- Branch: development
- Impact: medium
- Category: Integracion-2.2.3
- Summary: revert to npm + deps neon-js/react-router-dom + vercel docs
- Date: 2026-02-03
- Branch: development
- Impact: high
- Category: Release-2.5.0
- Summary: enforce stack auth + neon-only data flow
- Date: 2026-02-04
- Branch: development
- Impact: medium
- Category: Release-3.0.1
- Summary: landing unidep + centering + A/B verify neon
- Date: 2026-02-04
- Branch: development
- Impact: low
- Category: Release-3.0.1
- Summary: agrega archivo VERSION 3.0.1
- Date: 2026-02-04
- Branch: development
- Impact: low
- Category: Release-3.0.2
- Summary: afina layout del landing
- Date: 2026-02-04
- Branch: development
- Impact: high
- Category: Release-3.1.0
- Summary: migra a Neon Auth (better auth) + UI propia
- Date: 2026-02-05
- Branch: development
- Impact: low
- Category: Release-3.1.1
- Summary: ajusta landing (bienvenido/unidep) y footer powered by
- Date: 2026-02-06
- Branch: development
- Impact: medium
- Category: release-3.2.0
- Summary: corrige landing (logos ReCalc/ReLead/UNIDEP) + inicia flujo auth
- Date: 2026-02-06
- Branch: development
- Impact: medium
- Category: release-3.2.0
- Summary: bump version en manifest (extension) + corrige orden de promote a last-stable
- Date: 2026-02-06
- Branch: development
- Impact: medium
- Category: release-3.2.0
- Summary: arregla flujo en sitio estatico (sin /auth/*) + limpia header/footer
- Date: 2026-02-08
- Branch: development
- Impact: medium
- Category: release-3.2.0
- Summary: elimina HTML/JS/CSS estatico del repo (backup externo) y deja landing Next full-screen
- Date: 2026-02-08
- Branch: development
- Impact: medium
- Category: release-3.2.0
- Summary: panel post-auth responsive con datos Neon + unlock admin (3 clicks) + Docker + Playwright + callbackURL sign-up por dominio
- Date: 2026-02-08
- Branch: development
- Impact: medium
- Category: release-3.2.0
- Summary: fuerza builder de Next en Vercel (vercel.json) para evitar 404 por output static/public
- Date: 2026-02-08
- Branch: development
- Impact: medium
- Category: release-3.2.0
- Summary: configura allowedDevOrigins en next.config.ts (Playwright/127.0.0.1) y evita warning cross-origin en dev
- Date: 2026-02-08
- Branch: development
- Impact: medium
- Category: release-3.2.0
- Summary: cambia ruta post-login a /unidep (mantiene /app-real como redirect)
- Date: 2026-02-08
- Branch: development
- Impact: medium
- Category: release-3.2.0
- Summary: corrige email admin autorizado + actualiza Playwright (login a /unidep con cuenta de prueba) y config de baseURL
- Date: 2026-02-08
- Branch: development
- Impact: low
- Category: release-3.2.0
- Summary: aumenta tamaño del logo ReCalc en header y logo ReLead en footer (landing + panel)
- Date: 2026-02-08
- Branch: development
- Impact: low
- Category: release-3.2.0
- Summary: mejora fondo de /auth (azul + watermark UNIDEP) para consistencia visual
- Date: 2026-02-09
- Branch: development
- Impact: medium
- Category: release-3.2.0
- Summary: unifica iconografia del dock (SVG consistente) y ajusta alineacion/size en CSS
- Date: 2026-02-09
- Branch: development
- Impact: medium
- Category: release-3.2.0
- Summary: /unidep UI consistente (dropdowns/animaciones/a11y) + fix robusto de lookup de costos + e2e costo-flow
- Date: 2026-02-09
- Branch: development
- Impact: medium
- Category: release-3.2.0
- Summary: separa PublicLayout/AppLayout (sin sidebar en public) + AppChrome con sidebar/drawer + AppSelect (Radix) + elimina bloque ReCalc Panel UNIDEP
- Date: 2026-02-09
- Branch: development
- Impact: medium
- Category: release-3.2.0
- Summary: QA e2e de acceptance (public sin sidebar, responsive sin overflow, AppSelect keyboard) + actualiza tests de costos para Radix Select
- Date: 2026-02-09
- Branch: development
- Impact: medium
- Category: release-3.2.0
- Summary: mejora UX de /auth (watermark sutil en background) + ajusta tamanos de logos (UNIDEP/ReLead/ReCalc) para consistencia visual
- Date: 2026-02-09
- Branch: development
- Impact: medium
- Category: release-3.2.0
- Summary: AppSelect asegura foco dentro del panel al abrir (teclado) + estabiliza e2e keyboard-select
 
- Date: 2026-02-09 
- Branch: development 
- Impact: high 
- Category: release-3.2.0 
- Summary: setup Prisma + esquema admin en Neon (schema recalc_admin) + migraciones + bootstrap-admin con bcrypt
 
- Date: 2026-02-09 
- Branch: development 
- Impact: high 
- Category: release-3.2.0 
- Summary: admin panel (triple click) + session httpOnly + CRUD M1-M4 + integra CTAs y SidebarInfo en UI publica + AssistLoop

- Date: 2026-02-10
- Branch: development
- Impact: medium
- Category: release-3.4.1
- Summary: background publico + smart selects + links legales + empty state beneficios

- Date: 2026-02-10
- Branch: development
- Impact: medium
- Category: release-3.4.1
- Summary: beneficio adicional informativo + modulo ingreso + cargo academico + desglose final

- Date: 2026-02-10
- Branch: development
- Impact: medium
- Category: release-3.4.1
- Summary: auth reset/google + gate admin por email + alcance beneficios + divisor home

- Date: 2026-02-10
- Branch: main
- Impact: medium
- Category: release-3.4.1
- Summary: auth reset/google + gate admin por email + alcance beneficios + divisor home

- Date: 2026-02-10
- Branch: last-stable
- Impact: medium
- Category: release-3.4.1
- Summary: auth reset/google + gate admin por email + alcance beneficios + divisor home

- Date: 2026-02-10
- Branch: development
- Impact: low
- Category: release-3.4.1
- Summary: actualiza pushlog de release-3.4.1

- Date: 2026-02-10
- Branch: main
- Impact: low
- Category: release-3.4.1
- Summary: actualiza pushlog de release-3.4.1

- Date: 2026-02-10
- Branch: last-stable
- Impact: low
- Category: release-3.4.1
- Summary: actualiza pushlog de release-3.4.1

- Date: 2026-02-11
- Branch: development
- Impact: medium
- Category: release-3.4.1
- Summary: UI/auth hardening + roles (USER/ADMIN) + panel usuarios + invitaciones por email + middleware/admin guards

- Date: 2026-02-11
- Branch: main
- Impact: medium
- Category: release-3.4.1
- Summary: promote desde development con UI/auth hardening + roles + usuarios/invitaciones

- Date: 2026-02-11
- Branch: last-stable
- Impact: medium
- Category: release-3.4.1
- Summary: promote desde main para mantener release-3.4.1 estable

- Date: 2026-02-11
- Branch: development
- Impact: medium
- Category: release-3.4.1
- Summary: import _output (Prisma) + APIs/sidebar desde DB + panel oferta tras modulo + duración solo admin en público

- Date: 2026-02-19
- Branch: main
- Impact: high
- Category: release-3.4.1
- Commit: 7e0e826
- Summary: [INICIO MIGRACIÓN A PRISMA] primer commit en git: introduce prisma/schema.prisma, src/lib/prisma.ts y migración baseline (20260209_baseline); script import-output con timeout 120 000 ms; .gitignore actualizado

- Date: 2026-02-20
- Branch: main
- Impact: low
- Category: release-3.4.1
- Commit: 974b1c2
- Summary: fix moduloLabelId useId en ScholarshipCalculator

- Date: 2026-02-20
- Branch: main
- Impact: low
- Category: release-3.4.1
- Commit: 1aed375
- Summary: fix moduloIngreso state y moduloOptions en ScholarshipCalculator

- Date: 2026-02-20
- Branch: main
- Impact: low
- Category: release-3.4.1
- Commit: 604f050
- Summary: elimina legacy builds config de vercel.json

- Date: 2026-02-24
- Branch: main
- Impact: high
- Category: feature-4.0.0
- Commit: 010a78e (PR #17)
- Summary: agrega panel admin UNIDEP, cuotas estructuradas, módulo de oferta académica (M1-M4) y UX mejorada

- Date: 2026-02-24
- Branch: main
- Impact: medium
- Category: feature-4.0.0
- Commit: 88847d6 (PR #18)
- Summary: fix apply-unidep-migration endpoint + UI admin para corregir errores 500; elimina M4 Sidebar Info; fallback de migración en todas las páginas UNIDEP

- Date: 2026-02-24
- Branch: main
- Impact: medium
- Category: chore-4.0.0
- Commit: cf801ef…a6508b9
- Summary: [LIMPIEZA DE REPOSITORIO] eliminación de archivos obsoletos: branding/layout-logo-temp.svg, branding/logo-recalc.png, icons/icon128.png, icons/icon16.png, icons/icon32.png, icons/icon48.png, icons/logo_Recalc.PNG; se sube logo-recalc.png actualizado

- Date: 2026-02-24
- Branch: main
- Impact: medium
- Category: feature-4.0.0
- Commit: a9c5f3e (PR #19)
- Summary: refactoriza flujo de onboarding de invitados de extremo a extremo

- Date: 2026-02-25
- Branch: main
- Impact: low
- Category: chore-4.0.0
- Commit: b3bbb09 (PR #20)
- Summary: recorta márgenes vacíos de logo-recalc.png

- Date: 2026-02-25
- Branch: main
- Impact: low
- Category: feature-4.0.0
- Commit: 1bf07ce (PR #21)
- Summary: rebalancea tamaños de logos para armonía visual

- Date: 2026-02-25
- Branch: main
- Impact: low
- Category: hotfix-4.0.0
- Commit: 948c053 (PR #22)
- Summary: restaura tamaños proporcionales del logo ReCalc después del recorte PNG

- Date: 2026-02-25
- Branch: main
- Impact: low
- Category: hotfix-4.0.0
- Commit: 6fafebe (PR #23)
- Summary: reduce logos en home page al 50% para balance visual

- Date: 2026-02-25
- Branch: main
- Impact: high
- Category: feature-4.0.0
- Commit: 1400607 (PR #24)
- Summary: mejoras al panel admin: CTAs, Precios, Usuarios, Programas, Cuotas

- Date: 2026-02-26
- Branch: main
- Impact: high
- Category: feature-4.0.0
- Commit: 2101711 (PR #25)
- Summary: invitaciones: auto-crear cuenta con contraseña temporal + flujo mejorado

- Date: 2026-02-27
- Branch: main
- Impact: medium
- Category: hotfix-4.0.0
- Commit: 2e6bcf0 (PR #26)
- Summary: mejora manejo de CTAs; fix redirect Neon Auth; invites 500→401; tablas responsivas; pin TypeScript 5.9.3; mejora entregabilidad de email (DKIM, From name, plantilla HTML)

- Date: 2026-03-02
- Branch: main
- Impact: high
- Category: hotfix-4.0.0
- Commit: c8edbbd (PR #27)
- Summary: seguridad: elimina email admin hardcoded, agrega rate limiting, corrige redirect del middleware

- Date: 2026-03-02
- Branch: main
- Impact: high
- Category: feature-4.0.0
- Commit: f740823 (PR #28)
- Summary: actualiza importador de oferta académica a formato Online + Planteles

- Date: 2026-03-02
- Branch: main
- Impact: medium
- Category: hotfix-4.0.0
- Commit: 8f79895 (PR #29)
- Summary: importador Excel inteligente con auto-detección de hojas y columnas

- Date: 2026-03-02
- Branch: main
- Impact: medium
- Category: feature-4.0.0
- Commit: 8b86f5f (PR #30)
- Summary: limpieza de schema auth + página de diagnóstico auth-sync

- Date: 2026-03-02
- Branch: main
- Impact: medium
- Category: hotfix-4.0.0
- Commit: 0ca2a70 (PR #31)
- Summary: fix upserts de programas en lotes fuera de transacción para evitar timeout P2028 en importación

- Date: 2026-03-03
- Branch: main
- Impact: medium
- Category: hotfix-4.0.0
- Commit: 01abcb6 (PR #32)
- Summary: corrige errores de TypeScript y violaciones de ESLint que causaban fallos en deploy

- Date: 2026-03-03
- Branch: main
- Impact: low
- Category: chore-4.0.0
- Commit: ba56286 (PR #33)
- Summary: actualiza lockfile pg-protocol y config de claude dev

- Date: 2026-03-03
- Branch: main
- Impact: medium
- Category: hotfix-4.0.0
- Commit: 4f56d7c (PR #34)
- Summary: expone error real de DB en auth-sync + agrega paso de migración en vercel-build

- Date: 2026-03-03
- Branch: main
- Impact: low
- Category: hotfix-4.0.0
- Commit: 57bb98d (PR #35)
- Summary: maneja graciosamente la ausencia del schema neon_auth en la UI de auth-sync

- Date: 2026-03-03
- Branch: main
- Impact: high
- Category: feature-4.0.0
- Commit: 64a5e02 (PR #37/#38)
- Summary: agrega plugins de infraestructura Better Auth + Prisma Accelerate (acelerador de queries vía Prisma Platform)

- Date: 2026-03-03
- Branch: main
- Impact: medium
- Category: hotfix-4.0.0
- Commit: a8a90a3 (PR #39)
- Summary: deriva DIRECT_URL desde vars DATA_PRISMA_* de Vercel en tiempo de build (corrige P1012)

- Date: 2026-03-03
- Branch: main
- Impact: medium
- Category: hotfix-4.0.0
- Commit: 11193b4 (PR #40)
- Summary: reordena migración academic_offerings después de campus_catalog para evitar fallo FK P3009

- Date: 2026-03-03
- Branch: main
- Impact: high
- Category: hotfix-4.0.0
- Commit: 8439a37 (PR #41)
- Summary: elimina Better Auth, corrige query neon_auth.user en auth-sync M7, reordena menú admin, agrega seed JSON de activación de cuota campus

- Date: 2026-03-03
- Branch: main
- Impact: low
- Category: hotfix-4.0.0
- Commit: 1036b17 (PR #42)
- Summary: renombra init_admin → a_init_admin para corregir P3018 (schema recalc_admin faltante)

- Date: 2026-03-03
- Branch: main
- Impact: medium
- Category: hotfix-4.0.0
- Commit: 16e3d3e (PR #43)
- Summary: restaura inferencia de tipos Prisma select/include rota por extension-accelerate@3.0.1

- Date: 2026-03-03
- Branch: main
- Impact: medium
- Category: hotfix-4.0.0
- Commit: 5964833 (PR #44)
- Summary: refactoriza detección de cookie auth y centraliza normalización de email

- Date: 2026-03-03
- Branch: main
- Impact: medium
- Category: chore-4.0.0
- Commit: 683b339 (PR #45)
- Summary: [LIMPIEZA DE CÓDIGO — code review cleanup] elimina react-router-dom no usado; mueve xlsx/bcryptjs/dotenv a devDependencies; crea normalizeEmail compartido; mejora type-safety en authz.ts con PrismaClientKnownRequestError

- Date: 2026-03-03
- Branch: main
- Impact: low
- Category: hotfix-4.0.0
- Commit: 21c5647
- Summary: fix getAllowedUser (eliminado de auth-guard) → getSessionUser desde authz

- Date: 2026-03-03
- Branch: main
- Impact: medium
- Category: chore-4.0.0
- Commit: 013c14e (PR #46)
- Summary: [LIMPIEZA DE CÓDIGO — continuación] correcciones adicionales de code review: normalize.ts, dominio.ts

- Date: 2026-03-04
- Branch: main
- Impact: high
- Category: release-4.0.0
- Commit: 07c94ae (PR #47)
- Summary: migra de Prisma Postgres (Vercel integration) a integración nativa Neon; corrige DIRECT_URL que apuntaba a db.prisma.io en lugar de *.neon.tech; agrega fallbacks POSTGRES_URL_NON_POOLING/DATABASE_URL_UNPOOLED en resolveDirectDatabaseUrl()

- Date: 2026-03-04
- Branch: main
- Impact: medium
- Category: hotfix-4.0.0
- Commit: 31a59e4 (PR #48)
- Summary: corrige problemas post-migración a Neon nativo (ronda 1)

- Date: 2026-03-04
- Branch: main
- Impact: medium
- Category: hotfix-4.0.0
- Commit: 66701e3 (PR #49)
- Summary: corrige problemas post-migración a Neon nativo (ronda 2)

- Date: 2026-03-04
- Branch: main
- Impact: high
- Category: hotfix-4.0.0
- Commit: db0044b (PR #50)
- Summary: corrige flujo auth del panel admin: deja de saltarse /admin/auth para sesiones que no son admin

- Date: 2026-03-06
- Branch: main
- Impact: medium
- Category: release-5.2.1
- Commit: 4139724
- Summary: restaura el exchange de sesión OAuth de Google en middleware y reconoce cookies __Secure-neon-auth

- Date: 2026-03-06
- Branch: main
- Impact: medium
- Category: release-5.2.2
- Commit: 3c77cc0
- Summary: reemplaza Server Actions de auth por rutas POST estables para evitar “Server Action not found”
