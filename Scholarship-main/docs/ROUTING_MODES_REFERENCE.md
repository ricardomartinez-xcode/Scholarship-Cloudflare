# Referencia de Rutas y Modos de Ejecución

**Fecha**: 2026-03-11  
**Estado**: Vigente — Bloque 4C: Consolidación de rutas legacy, compare y canonical

---

## 1. Mapa de rutas de navegación

### Rutas públicas / sin sesión

| Ruta | Descripción | Estado |
|------|-------------|--------|
| `/` | Página principal (acceso/landing) | Canónica |
| `/auth/sign-in` | Inicio de sesión de usuario | Canónica |
| `/auth/sign-up` | Registro de usuario | Canónica |
| `/auth/reset-password` | Recuperación de contraseña | Canónica |
| `/auth/denied` | Acceso denegado | Canónica |
| `/invite/accept` | Aceptar invitación | Canónica |
| `/legal/privacy` | Aviso de privacidad | Canónica |
| `/legal/terms` | Términos y condiciones | Canónica |

### Rutas de aplicación (usuario autenticado)

| Ruta | Descripción | Estado | Notas |
|------|-------------|--------|-------|
| `/unidep` | Panel principal post-login (calculadora de becas) | **Canónica** | Destino preferente para todos los flujos post-login |
| `/app-real` | Acceso legacy al panel | **Legacy / Redirige** | Solo redirige a `/unidep`; se mantiene por compatibilidad temporal con marcadores y enlaces externos |
| `/profile` | Perfil del usuario | Canónica | |

> **Criterio canónico**: `/unidep` es el único punto de entrada legítimo al panel de usuario.  
> `/app-real` **no debe aparecer en nuevos desarrollos**. Puede eliminarse cuando se confirme que no hay referencias externas activas.

### Rutas de administración (alcance Bloque 4C)

> **Alcance**: esta tabla no es exhaustiva. Solo lista rutas de administración relevantes para la consolidación de modos **legacy / compare / canonical**.  
> Otras rutas operativas de admin (por ejemplo: `/admin/oferta`, `/admin/sidebar`, `/admin/ctas`, `/admin/comunicados`, `/admin/auth-sync`) quedan fuera de este documento.

| Ruta | Descripción | Estado |
|------|-------------|--------|
| `/admin` | Dashboard admin — redirige según capabilities del usuario (reporting, benefits, prices, oferta, users, invitations, sidebar, organizations; en ese orden de preferencia) | Redirige según permisos |
| `/admin/reporting` | Panel de reporte | Canónica |
| `/admin/prices` | Gestión de precios y reglas de beca | Canónica |
| `/admin/invitations` | Gestión de invitaciones | Canónica |
| `/admin/organizations` | Gestión de organizaciones | Canónica |
| `/admin/users` | Gestión de usuarios | Canónica |
| `/admin/unidep/directory` | Directorio de contactos | Canónica |
| `/admin/unidep/fees` | Cuotas y derechos | Canónica |
| `/admin/unidep/campuses` | Planteles | Canónica |
| `/admin/unidep/programs` | Programas académicos | Canónica |
| `/admin/unidep/simulador` | Simulador admin | Canónica |
| `/admin/benefits` | Beneficios adicionales | Canónica |
| `/admin/whatsapp-templates` | Plantillas WhatsApp | Canónica |
| `/admin/audit` | Bitácora de auditoría | Canónica |
| `/admin/auth` | Auth admin (login/callback) | Canónica |

---

## 2. Mapa de rutas de API

### API de datos (requieren sesión de usuario)

| Ruta | Descripción | Modo controlado por |
|------|-------------|---------------------|
| `GET /api/data/flat-rules` | Reglas de beca planas | `PRICING_READ_MODE` |
| `GET /api/data/meta` | Metadatos de precios (legacy) | `PRICING_READ_MODE` (solo logging en compare) |
| `GET /api/data/regreso-materias` | Precios por materia (regreso) | `PRICING_READ_MODE` |
| `POST /api/data/quote` | Cálculo de cotización de beca | `QUOTE_MODE` |
| `GET/POST /api/data/quote-history` | Historial de cotizaciones | `QUOTE_MODE` (solo valor por defecto/metadata de `quoteMode`; la lógica de guardado es común a todos los modos) |
| `GET /api/data/benefits` | Beneficios adicionales | Sin modo — solo Prisma |
| `GET /api/data/simulador` | Delegado de quote-history | Sin modo propio |
| `GET /api/data/whatsapp-templates` | Plantillas WhatsApp | Sin modo |

### API pública (sin sesión requerida)

| Ruta | Descripción | Modo controlado por |
|------|-------------|---------------------|
| `GET /api/public/directorio` | Directorio de contactos | `DIRECTORY_READ_MODE` |
| `GET /api/public/campuses` | Catálogo de planteles | Sin modo |
| `GET /api/public/costos` | Cuotas y derechos | Sin modo |
| `GET /api/public/oferta` | Oferta académica | Sin modo |
| `GET /api/public/planes` | Planes académicos | Sin modo |

### API de administración

| Ruta | Descripción | Notas |
|------|-------------|-------|
| `POST /api/admin/invites` | Envío de invitaciones | Sin modo |
| `GET/POST /api/admin/organizations` | Organizaciones | Sin modo |
| `POST /api/admin/revalidate` | Revalidar caché | Sin modo |
| `GET/POST /api/admin/import-academic-offer` | Importar oferta | Sin modo |

---

## 3. Sistema de modos de ejecución (`RuntimeMode`)

El sistema de modos permite la **migración gradual** de la implementación legacy (tablas `recalc_*` en Neon) a la implementación canónica (Prisma ORM con esquema normalizado), sin interrumpir el servicio.

### Valores de modo

| Valor | Comportamiento |
|-------|---------------|
| `"legacy"` | Lee y devuelve solo datos legacy (tablas `recalc_*`). **Valor por defecto** si no se configura la variable de entorno. |
| `"compare"` | Lee ambas implementaciones, registra diferencias en logs (`[canonical-compare]`), y devuelve datos legacy para producción. Útil para validar la paridad antes de migrar. |
| `"canonical"` | Lee y devuelve solo datos de la implementación canónica (Prisma). Destino final de la migración. |

### Variables de entorno

| Variable | Subsistema | Destino canónico |
|----------|------------|-----------------|
| `PRICING_READ_MODE` | Reglas de beca, meta, regreso-materias | `"canonical"` |
| `DIRECTORY_READ_MODE` | Directorio público de contactos | `"canonical"` |
| `DIRECTORY_WRITE_MODE` | Escritura en directorio (sincronización de métodos) | `"canonical"` |
| `QUOTE_MODE` | Cálculo de cotización y guardado de historial | `"canonical"` (ver nota) |

> **Nota sobre `QUOTE_MODE`**: La ruta `/api/data/quote` ya es **canonical-first**: siempre ejecuta `resolveScholarshipQuote` (implementación canónica) independientemente del modo configurado. El modo solo activa el logging de comparación con el motor legacy cuando se establece en `"compare"`. Configurar `QUOTE_MODE=legacy` o `QUOTE_MODE=canonical` produce el mismo resultado (retorno canónico sin comparación). El motor legacy en este contexto es solo una herramienta de auditoría.

### Comportamiento por subsistema

#### Precios (`PRICING_READ_MODE`)

| Modo | flat-rules | regreso-materias | meta |
|------|-----------|-----------------|------|
| `legacy` (default) | Devuelve datos legacy (`recalc_regla_beca`) | Devuelve datos legacy | Devuelve datos legacy (`recalc_meta`) |
| `compare` | Devuelve datos legacy + log de diferencias | Devuelve datos legacy + log de diferencias | Log de diferencias de tier por plantel (datos legacy siempre) |
| `canonical` | Devuelve datos Prisma (`ScholarshipRule`) | Devuelve datos Prisma (`ReturnSubjectPrice`) | ⚠️ Sin implementación canónica — siempre devuelve legacy |

> **Deuda técnica identificada**: `/api/data/meta` no tiene implementación canónica. La tabla `recalc_meta` no tiene equivalente en Prisma. Es el único endpoint de datos que no puede migrar a `canonical` todavía.

#### Directorio (`DIRECTORY_READ_MODE` / `DIRECTORY_WRITE_MODE`)

| Modo | Lectura pública (`/api/public/directorio`) | Escritura admin |
|------|------------------------------------------|-----------------|
| `legacy` (default) | Devuelve contactos **sin** campo `methods` | Solo actualiza `DirectoryContact` |
| `compare` | Devuelve sin `methods` + log de diferencias | Solo actualiza `DirectoryContact` |
| `canonical` | Devuelve contactos **con** campo `methods` | Actualiza `DirectoryContact` + sincroniza `DirectoryContactMethod` |

> El campo `methods` en la respuesta del directorio es la principal diferencia entre legacy y canonical. La migración a `canonical` habilita contactos con múltiples canales (email, teléfono, WhatsApp).

#### Cotización (`QUOTE_MODE`)

| Modo | Comportamiento |
|------|---------------|
| `legacy` | Retorna resultado canónico (sin logging de comparación) |
| `compare` | Retorna resultado canónico + log de diferencias con motor legacy |
| `canonical` | Retorna resultado canónico (sin logging de comparación) |

---

## 4. Coexistencia residual documentada

### Rutas de navegación con coexistencia

| Ruta legacy | Ruta canónica | Riesgo de eliminación | Acción recomendada |
|-------------|---------------|-----------------------|-------------------|
| `/app-real` | `/unidep` | Bajo — ya es solo un redirect | Mantener hasta confirmar ausencia de referencias externas; luego eliminar |

### Implementaciones duales activas

| Subsistema | Implementación legacy | Implementación canónica | Estado de paridad |
|------------|-----------------------|-------------------------|-------------------|
| Reglas de beca | `legacy-pricing.ts` + `recalc_regla_beca` | `canonical-pricing-readers.ts` + `ScholarshipRule` | En verificación — usar `compare` mode para validar |
| Precios regreso | `recalc_regreso_materias` (Neon SQL) | `ReturnSubjectPrice` (Prisma) | En verificación |
| Cotización | `computeLegacyScholarshipQuote()` | `resolveScholarshipQuote()` | Canónico activo en producción |
| Directorio | Proyección sin `methods` | Proyección con `methods` | Depende de `DIRECTORY_READ_MODE` |
| Meta pricing | `recalc_meta` | ❌ Sin equivalente | Migración pendiente |

---

## 5. Camino de migración

Para completar la consolidación, el orden recomendado es:

1. **`PRICING_READ_MODE=compare`** → Validar paridad entre legacy y canonical en `flat-rules` y `regreso-materias`.  
2. **`PRICING_READ_MODE=canonical`** → Una vez validada la paridad, promover a canonical.  
3. **`DIRECTORY_READ_MODE=compare` + `DIRECTORY_WRITE_MODE=compare`** → Validar sincronización de métodos de contacto.  
4. **`DIRECTORY_READ_MODE=canonical` + `DIRECTORY_WRITE_MODE=canonical`** → Activar métodos de contacto en producción.  
5. **`/api/data/meta`** → Diseñar equivalente canónico en Prisma para `recalc_meta` o consolidar los campos relevantes (especialmente `planteles[].tier`) directamente en el modelo `Campus`.  
6. **Eliminar `/app-real`** → Tras confirmar que no hay referencias externas activas.  
7. **Depurar `legacy-pricing.ts`** y `computeLegacyScholarshipQuote()` → Solo cuando todos los modos estén en `"canonical"` y validados.

---

## 6. Guía de lectura para desarrolladores

- Los archivos `src/lib/runtime-modes.ts` y `src/lib/runtime-comparison.ts` son la infraestructura transversal de comparación. No requieren cambios para la migración; solo ajustar las variables de entorno.  
- El logging de comparación usa el prefijo `[canonical-compare]` en los logs estructurados. Buscar este prefijo para auditar diferencias en producción.  
- Las funciones `shouldMirrorLegacyPricingWrites()` y `shouldMirrorLegacyDirectoryWrites()` controlan si las escrituras admin se duplican también en las tablas legacy. Se vuelven `false` cuando el modo está en `"canonical"`.  
- Los scripts en `scripts/` (`backfill-canonical-data.ts`, `compare-canonical-data.ts`, `backup-legacy-data.ts`) son herramientas de soporte para la migración de datos.
