# Auditoría técnica detallada — Fases 2 a 12

## Alcance

Esta auditoría continúa la línea base ya abierta para Fase 1 y Fase 10, y revisa estáticamente el repositorio para identificar:

- hallazgos confirmados por código;
- riesgos de arquitectura, seguridad, UX y mantenibilidad;
- evidencia por archivo;
- prioridad sugerida;
- relación con el plan maestro.

> Nota: esta auditoría es principalmente **estática**. Identifica problemas visibles en el código y la estructura del repositorio, pero no sustituye pruebas integrales en runtime, validación contra datos reales ni revisión manual del flujo completo en preview/producción.

---

## Resumen ejecutivo

### Riesgos críticos

1. **El modelo de autorización administrativa todavía depende del legado `Role.ADMIN -> todas las capacidades`.**
2. **La activación de invitaciones puede ocurrir implícitamente durante sincronización de sesión, antes de completar un flujo explícito de aceptación.**
3. **Existen rutas técnicas/operativas visibles dentro del panel sin una separación suficientemente clara entre operación normal, configuración sensible y desarrollo.**
4. **Hay deuda estructural por coexistencia de rutas canónicas, rutas legacy y módulos parcialmente duplicados.**
5. **Persisten nombres de capacidades y conceptos mal definidos o inconsistentes, lo que complica enforcement real y mantenibilidad.**

### Riesgos altos

1. **El sistema de ubicaciones UI para CTAs y banners usa slots enumerados útiles pero todavía vagos y cerrados, sin modelo espacial más robusto.**
2. **La UX de invitación ya tiene base funcional, pero sigue siendo más técnica que narrativa y no explica suficientemente quién invita, a qué organización entra el usuario y qué pasará exactamente.**
3. **El panel admin mezcla dominios de negocio, monitoreo técnico y configuración operativa en una misma navegación.**
4. **Hay duplicación real de scripts operativos con naming inconsistente (`snake_case`, `kebab-case`, `.py`, `.mjs`, `.sh`) y propósitos solapados.**
5. **La extensión de Chrome no está presente como módulo mantenible del repo; la fase 11 hoy no tiene base implementada.**

### Riesgos medios

1. **El tema visual tiene buena base de tokens, pero el dark theme sigue demasiado cargado hacia negros y `slate-950` en varias superficies administrativas.**
2. **La responsividad de tablas está parcialmente resuelta; hay buen uso de `overflow-x-auto` y `min-w-*`, pero todavía es heterogénea.**
3. **El catálogo de `UserCapability` parece experimental y con errores de naming que afectan claridad.**
4. **Hay documentación dispersa y útil, pero no un mapa único que conecte arquitectura, permisos, módulos, scripts y rollout.**

---

# Fase 2 — Saneamiento de roles y seguridad administrativa

## Estado
**Parcial / riesgoso**

## Hallazgos

### 2.1 Herencia total del rol `ADMIN`
`src/lib/admin-capabilities.ts` define `LEGACY_ADMIN_CAPABILITIES` como el conjunto completo de capacidades administrativas. Luego `getLegacyRoleCapabilities(role)` entrega todas las capacidades si el rol es `Role.ADMIN`.

**Evidencia:**
- `src/lib/admin-capabilities.ts`

**Impacto:**
- debilita el valor del catálogo de capacidades;
- vuelve opcional o decorativo parte del modelo de permisos;
- complica separar admin root de admin operativo.

### 2.2 Acceso al panel admin basado en legado
`canAccessAdminPanel()` devuelve acceso total si `role === Role.ADMIN`, aun cuando el modelo de capacidades sugiera granularidad más fina.

**Evidencia:**
- `src/lib/admin-capabilities.ts`
- `src/lib/admin-session.ts`

### 2.3 Separación incompleta entre privilegios globales y privilegios por organización
El repositorio ya modela:
- `Role` global (`USER`, `ADMIN`)
- `OrgRole` (`owner`, `admin`, `member`)
- overrides de capacidades admin

Pero no existe todavía una capa consolidada de autorización efectiva que diferencie claramente:
- privilegio global del sistema;
- privilegio operativo del panel;
- privilegio dentro de una organización.

**Evidencia:**
- `prisma/schema.prisma`
- `src/lib/admin-session.ts`
- `src/app/(admin)/admin/(protected)/users/page.tsx`

### 2.4 Autoescalación indirecta por email raíz
`authz.ts` promueve a `Role.ADMIN` si el correo coincide con la lógica de `isAdminEmail(...)`.

**Evidencia:**
- `src/lib/authz.ts`

**Riesgo:**
- útil como break-glass o root admin;
- peligroso si no queda documentado y encapsulado como mecanismo excepcional.

## Recomendación

1. introducir una capa explícita de acceso efectivo del sistema;
2. mantener `Role.ADMIN` sólo como compatibilidad temporal o root role excepcional;
3. separar:
   - `system_role`
   - `admin_profile`
   - `organization_role`
4. documentar y aislar `isAdminEmail()` como override de bootstrap, no como regla cotidiana.

---

# Fase 3 — Corrección real del sistema de permisos

## Estado
**Parcial / inconsistente**

## Hallazgos

### 3.1 El catálogo de capacidades admin sí existe, pero su enforcement no está totalmente desacoplado del legado
El repositorio sí tiene catálogo, labels, checks y navegación condicionada.

**Evidencia:**
- `src/lib/admin-capabilities.ts`
- `src/lib/admin-session.ts`
- `src/components/admin/AdminChrome.tsx`

### 3.2 El enforcement está repartido entre navegación, páginas y helpers
Se observan checks en:
- navegación (`AdminChrome`)
- páginas (`requireAdminCapabilityUser(...)`)
- sesión (`adminHasCapability(...)`)

Eso es positivo, pero todavía no existe una matriz centralizada `capacidad -> pantalla -> acción -> mutación -> validación`.

### 3.3 Hay conceptos de permiso confusos o mal nombrados en `UserCapability`
El enum `UserCapability` contiene elementos como:
- `manage_comunications`
- `owner_permitions`

Esto sugiere deuda de naming y posible inmadurez conceptual.

**Evidencia:**
- `prisma/schema.prisma`
- `src/lib/user-capabilities.ts`
- `prisma/migrations/20260312_add_user_capabilities/migration.sql`

### 3.4 Posible solapamiento entre permisos administrativos y permisos de usuario final
Algunas capacidades de usuario (`manage_template`, `view_audit`, `access_admin_cta`) parecen acercarse a facultades administrativas, pero viven en otro catálogo.

**Riesgo:**
- confusión entre “permiso de producto” y “permiso de administración”.

## Recomendación

1. crear matriz única de enforcement;
2. renombrar capacidades defectuosas;
3. separar claramente:
   - capacidades de administración;
   - capacidades de experiencia de usuario;
   - capacidades de organización;
4. identificar permisos decorativos y eliminarlos si no tienen enforcement real.

---

# Fase 4 — Reorganización del panel administrativo

## Estado
**Implementado parcialmente, pero mezclado**

## Hallazgos

### 4.1 La navegación ya agrupa parcialmente por zonas
`AdminChrome.tsx` divide navegación en:
- primaria
- administración
- UNIDEP

Eso ayuda, pero no coincide todavía con los dominios del plan (`Operación`, `Contenido`, `Usuarios y acceso`, `Configuración`, `Desarrollo`).

### 4.2 Módulos técnicos siguen mezclados con operación
Elementos como:
- `Reporte Operativo`
- `Auditoría`
- health checks
- asset health
- webhook proposal / reporting

siguen pegados al mismo ecosistema de navegación y no aislados como dominio de desarrollo/plataforma.

**Evidencia:**
- `src/components/admin/AdminChrome.tsx`
- `src/app/(admin)/admin/(protected)/reporting/page.tsx`
- `src/app/(admin)/admin/(protected)/audit/page.tsx`
- `src/app/api/admin/health/route.ts`

### 4.3 Endpoint técnico sin sesión admin
`GET /api/admin/health` declara explícitamente que no requiere sesión admin. Eso puede ser útil para despliegue, pero debe revisarse porque expone estado operativo interno.

**Evidencia:**
- `src/app/api/admin/health/route.ts`

## Recomendación

1. mover health checks, reporting técnico, webhook proposal y tooling a dominio `Desarrollo`;
2. dejar `Operación` para tareas diarias;
3. dejar `Configuración` para versiones, publicaciones y rollback;
4. restringir endpoints técnicos por entorno, auth fuerte o allowlist cuando corresponda.

---

# Fase 5 — Rediseño del flujo de invitaciones

## Estado
**Funcional, pero no completamente seguro/explicativo**

## Hallazgos

### 5.1 Sí existe landing dedicada de invitación
Hay una página específica en `/invite/accept`.

**Evidencia:**
- `src/app/(public)/invite/accept/page.tsx`

### 5.2 El flujo muestra validaciones importantes
La landing valida:
- token presente;
- invitación válida;
- usada/no usada;
- expiración;
- sesión correcta por email.

Eso es positivo.

### 5.3 Falta narrativa completa de invitación
La página no comunica de forma suficientemente explícita:
- quién invita;
- organización objetivo;
- alcance del acceso;
- diferencia entre usuario nuevo y usuario existente.

### 5.4 Riesgo de activación implícita
`syncUserRecord()` puede consumir invitaciones pendientes durante creación/login de sesión, incluso antes de completar un flujo deliberado en `/invite/accept`.

**Evidencia:**
- `src/lib/authz.ts`
- `src/lib/invites.ts`
- `src/app/(public)/invite/accept/page.tsx`

**Impacto:**
- contradice el objetivo de evitar activaciones accidentales o implícitas;
- dificulta razonar sobre el estado real del invite;
- puede sorprender al usuario o a soporte.

### 5.5 El modelo soporta expiración/cancelación, pero la semántica es técnica
Cancelación se implementa adelantando `expiresAt` a `createdAt`, lo cual funciona pero no expresa estado semántico puro.

**Evidencia:**
- `src/lib/invites.ts`

## Recomendación

1. convertir `/invite/accept` en punto único de consumo del token;
2. impedir consumo automático de invite en `syncUserRecord()` salvo flujo explícito;
3. mostrar claramente:
   - email invitado
   - organización
   - rol de ingreso
   - acción esperada
4. separar UX para usuario nuevo vs usuario existente.

---

# Fase 6 — Consolidación de rutas, módulos y duplicados

## Estado
**Deuda técnica visible**

## Hallazgos

### 6.1 Coexisten rutas y conceptos canónicos con legacy
Hay presencia clara de modos:
- `legacy`
- `compare`
- `canonical`

**Evidencia:**
- `src/lib/runtime-modes.ts`
- `src/lib/quote-history.ts`
- `src/components/ScholarshipCalculator.tsx`
- `src/components/unidep/UnidepWorkspace.tsx`
- `src/app/api/data/quote/route.ts`
- `src/app/api/data/flat-rules/route.ts`

### 6.2 Módulos potencialmente solapados
`/admin/oferta` convive con `/admin/unidep/programs`. No son idénticos, pero ambos orbitan la gestión de oferta/programas.

**Evidencia:**
- `src/app/(admin)/admin/(protected)/oferta/page.tsx`
- `src/app/(admin)/admin/(protected)/unidep/programs/page.tsx`

### 6.3 Scripts duplicados o casi duplicados
Se observan pares como:
- `seed-public-http.py` y `seed_public_http.py`
- `seed-campuses-http.py` y `seed_campuses_http.py`
- varios runners HTTP/curl/migrate con lógica similar
- `import-output.js` e `import-output.ts`

**Evidencia:**
- directorio `scripts/`

### 6.4 Artefactos output llegaron al repo
Se detectaron logs versionados en `output/playwright/`.

## Recomendación

1. definir rutas canónicas y legacy con fecha de retiro;
2. decidir si `oferta` será módulo de gobernanza/config y `unidep/programs` el CRUD operativo, o fusionarlos;
3. consolidar scripts en un flujo oficial por categoría:
   - migrate
   - seed
   - verify
   - release
4. remover output versionado definitivamente.

---

# Fase 7 — Sistema de mapeo UI y slots reales

## Estado
**Base útil, pero todavía limitada**

## Hallazgos

### 7.1 Existe catálogo de ubicaciones para CTAs
El repo ya modela múltiples ubicaciones mediante enum y catálogo.

**Evidencia:**
- `prisma/schema.prisma` (`AdminPublicCtaLocation`)
- `src/config/adminCatalogs.ts`

### 7.2 El modelo sigue basado en “zonas” cerradas
Las ubicaciones son útiles, pero todavía expresan zonas amplias (`ADMIN_CONTENT_TOP`, `SIDEBAR_TOP`, etc.), no una jerarquía precisa `page -> section -> panel -> slot -> breakpoint -> order -> visibility_rule`.

### 7.3 El sistema mezcla ubicación visual con semántica funcional
Algunas ubicaciones describen superficie; otras sugieren flujo o intención.

## Recomendación

1. migrar a modelo espacial explícito;
2. conservar compatibilidad traduciendo ubicaciones actuales a slots nuevos;
3. documentar mapa visual de superficies.

---

# Fase 8 — UI/UX, tema y jerarquía visual

## Estado
**Base sólida, pero aún sobrecargada en dark theme**

## Hallazgos

### 8.1 Sí existe sistema de tokens globales
`globals.css` ya define variables de UI y utilidades consistentes.

**Evidencia:**
- `src/app/globals.css`

### 8.2 El dark theme abusa de superficies muy oscuras
Se repiten combinaciones como:
- `bg-slate-950/*`
- `bg-black/15`
- `bg-black/20`

especialmente en admin.

### 8.3 La jerarquía visual técnica vs operativa aún no está del todo separada
Muchos paneles técnicos tienen peso visual parecido al contenido de operación.

## Recomendación

1. aclarar escalas de superficie;
2. definir color tokens por intención (`primary`, `secondary`, `contextual`, `technical`);
3. bajar densidad visual de paneles secundarios;
4. hacer visible el dominio funcional antes que el estado técnico.

---

# Fase 9 — Responsive de tablas y paneles

## Estado
**Aceptable, pero heterogéneo**

## Hallazgos

### 9.1 Hay trabajo real en tablas responsivas
Se usa frecuentemente:
- `overflow-x-auto`
- `min-w-*`
- celdas nowrap/wrap
- utilidades como `.ui-table-wrap`

**Evidencia:**
- `src/app/globals.css`
- `src/components/admin/InvitationsClient.tsx`
- `src/components/admin/OrganizationsClient.tsx`
- `src/components/admin/OfferImportClient.tsx`
- `src/components/admin/SidebarInfoClient.tsx`
- `src/components/admin/PricesClient.tsx`

### 9.2 La estrategia no es totalmente uniforme
Cada módulo resuelve layout de tabla de manera ligeramente distinta.

## Recomendación

1. homologar patrón de tabla admin;
2. estandarizar:
   - wrapper
   - densidad
   - sticky header
   - acciones
   - truncado
3. definir mínimos por tipo de tabla.

---

# Fase 10 — Saneamiento de secretos y configuración

## Estado
**Iniciado en la rama actual, pero requiere rotación y cierre**

## Hallazgos

### 10.1 Secretos embebidos detectados en scripts históricos
Se detectaron connection strings y passwords hardcodeados.

### 10.2 Hay buena base de variables y quality gates
Existe documentación razonable de entornos y secretos.

**Evidencia:**
- `docs/QUALITY_RELEASE_GATES.md`
- `src/lib/db-url.ts`
- `scripts/verify_neon.js`

### 10.3 Persisten endpoints técnicos que merecen revisión de exposición
El health endpoint y algunos flujos técnicos deben revisarse bajo lente de exposición operacional.

## Recomendación

1. rotar credenciales históricamente expuestas;
2. completar barrido en historial git si aplica;
3. endurecer exposición de rutas técnicas;
4. dejar un inventario único de variables requeridas.

---

# Fase 11 — Nueva extensión de Chrome

## Estado
**No implementada en el repo auditado**

## Hallazgos

No se encontró módulo claro de extensión Chrome, manifest ni estructura MV3 mantenible dentro del repositorio.

**Conclusión:**
- la fase 11 no está iniciada como código sostenible dentro del repo actual;
- debe tratarse como iniciativa separada o subpaquete dedicado.

## Recomendación

1. crear workspace específico para extensión;
2. usar MV3 + side panel;
3. prohibir acceso directo a admin desde la extensión;
4. consumir configuración remota vía backend/sitio.

---

# Fase 12 — Entregables y trazabilidad

## Estado
**Parcialmente cubierto, todavía disperso**

## Hallazgos

### 12.1 Ya existen docs útiles, pero no un hub único
Hay documentos de calidad, implementación y diseño, pero la trazabilidad aún está repartida.

**Evidencia:**
- `docs/QUALITY_RELEASE_GATES.md`
- `docs/IMPLEMENTATION_SUMMARY.md`
- `docs/AUTOMATED_CODE_REVIEW.md`
- `docs/plans/...`

### 12.2 Esta rama ya mejora trazabilidad
Con la auditoría base y este documento se empieza a crear un registro accionable.

## Recomendación

1. mantener documentos por tema;
2. registrar archivos tocados por fase;
3. ligar PRs a fases concretas;
4. generar checklist ejecutable por sprint.

---

## Backlog recomendado inmediato

### Bloque 1 — crítico
1. desmontar herencia total de `Role.ADMIN`;
2. impedir consumo implícito de invitaciones en `syncUserRecord()`;
3. endurecer `/api/admin/health`;
4. consolidar scripts operativos y terminar remoción de residuos versionados.

### Bloque 2 — alto
1. reorganizar navegación admin por dominios;
2. definir matriz de enforcement;
3. renombrar capacidades defectuosas;
4. separar módulos `oferta` vs `programas`.

### Bloque 3 — evolución
1. nuevo modelo de slots UI;
2. refinamiento visual del dark theme;
3. patrón único de tablas admin;
4. workspace de extensión MV3.
