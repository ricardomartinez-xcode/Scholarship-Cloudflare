# Backlog de ejecución derivado de la auditoría

## Objetivo

Convertir la auditoría en una secuencia de trabajo concreta, priorizada y revisable.

---

## Sprint / Bloque A — Seguridad y control

### A1. Reemplazar herencia total de `Role.ADMIN`
**Resultado esperado**
- `Role.ADMIN` deja de equivaler automáticamente a todas las capacidades.
- Se introduce un perfil transicional de acceso efectivo.

**Archivos candidatos**
- `src/lib/admin-capabilities.ts`
- `src/lib/admin-session.ts`
- `src/app/(admin)/admin/(protected)/users/*`
- `src/components/admin/AdminChrome.tsx`

### A2. Eliminar consumo implícito de invitaciones
**Resultado esperado**
- sólo `/invite/accept` consume el token;
- el login deja de activar acceso por accidente.

**Archivos candidatos**
- `src/lib/authz.ts`
- `src/lib/invites.ts`
- `src/app/(public)/invite/accept/page.tsx`
- `src/app/api/invite/accept/route.ts`

### A3. Endurecer health check administrativo
**Resultado esperado**
- endpoint técnico restringido por auth, entorno o allowlist;
- sin exposición innecesaria de estado interno.

**Archivos candidatos**
- `src/app/api/admin/health/route.ts`

### A4. Consolidar scripts oficiales
**Resultado esperado**
- un solo flujo por categoría: `migrate`, `seed`, `verify`, `release`.

**Archivos candidatos**
- `scripts/*`

---

## Sprint / Bloque B — Modelo administrativo

### B1. Matriz de enforcement real
**Resultado esperado**
- documento y/o módulo que relacione capacidad, ruta, vista, CTA y mutación.

### B2. Renombrar permisos confusos
**Resultado esperado**
- nombres consistentes y sin typos.

**Casos detectados**
- `manage_comunications`
- `owner_permitions`

### B3. Reorganización del admin por dominios
**Resultado esperado**
- navegación separada en:
  - Operación
  - Contenido
  - Usuarios y acceso
  - Configuración
  - Desarrollo

### B4. Redefinir root admin
**Resultado esperado**
- `isAdminEmail()` tratado como bootstrap excepcional, no como política central.

---

## Sprint / Bloque C — UX y estructura

### C1. Rediseño de invitaciones
**Resultado esperado**
- landing más clara;
- organización y acceso visibles;
- separación de usuario nuevo / existente.

### C2. Unificación de `oferta` y `programas`
**Resultado esperado**
- límites claros entre módulo de import/publicación y CRUD operativo.

### C3. Slots UI de nueva generación
**Resultado esperado**
- modelo `page / section / panel / slot / breakpoint / order / visibility_rule`.

### C4. Patrón único de tablas admin
**Resultado esperado**
- wrappers, densidad, truncado y acciones homogéneos.

---

## Sprint / Bloque D — Evolución de producto

### D1. Refinamiento visual del tema
**Resultado esperado**
- menos negro puro;
- mejor jerarquía visual;
- diferencia clara entre acción principal, contexto y tooling.

### D2. Workspace de extensión Chrome MV3
**Resultado esperado**
- módulo separado, side panel, integración con backend y sin acceso a admin.

### D3. Hub de trazabilidad
**Resultado esperado**
- índice de docs por fase, PR y estado.

---

## Checklist de aceptación por bloque

### Seguridad
- [ ] `Role.ADMIN` ya no implica todas las capacidades por defecto
- [ ] el token de invitación sólo se consume en el flujo explícito
- [ ] no hay secretos hardcodeados en scripts activos
- [ ] health check técnico no expone información sin control

### Administración
- [ ] el sidebar del admin refleja dominios, no mezcla técnica
- [ ] existe matriz de enforcement
- [ ] permisos confusos fueron renombrados o eliminados

### UX y deuda técnica
- [ ] rutas duplicadas o legacy tienen plan de retiro
- [ ] tablas admin siguen un mismo patrón
- [ ] slots UI permiten posicionamiento más preciso

### Trazabilidad
- [ ] cada PR se asocia a una fase
- [ ] cada cambio crítico deja evidencia documental
