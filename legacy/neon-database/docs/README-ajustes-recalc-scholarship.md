# Ajustes finales ReCalc / Scholarship

## Resumen
Se ajustaron **dos entregables**:

1. **Extensión Chrome ReCalc**
2. **Proyecto web Scholarship**

El objetivo fue acercar la web al lenguaje visual de la extensión, corregir densidad/layout, cerrar el flujo de cotización en la extensión y dejar conectado el flujo de campañas entre **admin panel + extensión + WhatsApp Web**.

---

## Cambios hechos en la WEB (Scholarship)

### 1) Libreta operativa / pendientes como sección independiente
Se movió la agenda operativa para que deje de competir visualmente con la calculadora.

**Archivo principal:**
- `src/components/unidep/UnidepWorkspace.tsx`

**Resultado esperado:**
- la calculadora respira mejor,
- el panel de pendientes ya no queda comprimido,
- el flujo visual queda más claro.

### 2) Sidebar contraíble / sobrepuesta
Se quitó la dependencia del layout fijo con sidebar estáica en desktop y se priorizó navegación por **overlay/drawer**, para que la interfaz principal no se mueva ni se achique.

**Archivo principal:**
- `src/components/app/AppChrome.tsx`

**Resultado esperado:**
- mejor aprovechamiento del ancho útil,
- calculadora y escenarios con más espacio,
- navegación más limpia y menos intrusiva.

### 3) Menor sensación de “zoom”
Se redujeron escalas generales: paddings, radios, densidad visual, tamaño percibido de tarjetas y contornos.

**Archivo principal:**
- `src/app/globals.css`

**Resultado esperado:**
- UI más natural,
- menos elementos “inflados”,
- mejor lectura en escritorio y paneles medianos.

### 4) Unificación visual con la extensión
Se ajustó la paleta a una línea más consistente con la extensión:
- azul profundo / teal oscuro,
- bordes más suaves,
- menos blancos duros,
- gradientes más discretos,
- sombras menos agresivas.

**Archivos principales:**
- `src/app/globals.css`
- `src/components/app/AppSidebar.tsx`

### 5) Mayor protagonismo del logo UNIDEP sin romper UI
Se mantuvo visible y con mejor presencia dentro del shell principal, pero sin volver a inflar el header.

**Archivo principal:**
- `src/components/app/AppChrome.tsx`

---

## Cambios hechos en la EXTENSIÓN

### 1) Cotización visible inmediatamente al calcular
Antes la cotización práctica quedaba ligada al botón de WhatsApp. Ahora la cotización y el mensaje se preparan **en cuanto se calcula**.

**Archivos:**
- `panel.html`
- `panel.js`
- `panel.css`

**Resultado esperado:**
- la sección **Resultado / Cotización** se llena al calcular,
- el usuario ve el total y el mensaje antes de enviarlo,
- el flujo queda más claro y menos confuso.

### 2) Flujo de acciones corregido
Se dejó el orden pedido:
- **Limpiar**
- **Calcular beca**
- **Mandar cotización**

Se quitó el botón de abrir WhatsApp del bloque incorrecto.

**Archivos:**
- `panel.html`
- `panel.js`

### 3) Mensaje editable y visible antes de enviarlo
La extensión ahora muestra el mensaje que va a mandar a WhatsApp dentro del panel, para que el usuario sepa qué texto se enviará.

**Archivos:**
- `panel.html`
- `panel.js`

### 4) Corrección del bug de mensaje triplicado
Se ajustó el content script para evitar que el texto se pegue varias veces en el composer de WhatsApp.

**Archivo principal:**
- `content-whatsapp.js`

**Resultado esperado:**
- el draft se pega una sola vez,
- si vuelve a intentarse con el mismo contenido, no duplica ni triplica el mensaje.

### 5) Header más compacto y útil
Se compactó el inicio del panel para que muestre datos realmente útiles:
- logo ReCalc,
- logo UNIDEP,
- sesión,
- última sync,
- Ir a WhatsApp,
- Ir a ReCalc,
- cerrar sesión.

**Archivos:**
- `panel.html`
- `panel.css`

### 6) Pestaña Campañas reorganizada
Se dejó en orden más operativo:
1. runner compacto,
2. contactos,
3. template,
4. imagen,
5. automatización / programación,
6. notas,
7. acciones finales.

Además se compactaron paneles y se mejoró el aprovechamiento vertical.

**Archivos:**
- `panel.html`
- `panel.css`
- `campaigns.js`

### 7) Templates guardables / seleccionables
Se añadió biblioteca local simple para guardar, seleccionar y borrar templates desde la extensión.

**Archivo principal:**
- `campaigns.js`

### 8) Resultados más compactos
Se redujo el riesgo de romper la UI cuando hay muchos destinatarios, usando render más compacto en vez de tarjetas pesadas.

**Archivos:**
- `campaigns.js`
- `panel.css`

---

## Conexión admin panel ↔ extensión
Se mantuvo y reforzó la conexión con Scholarship para campañas, media, templates y resultados.

**Archivos relevantes del proyecto web:**
- `src/components/admin/ExtensionCampaignsClient.tsx`
- `src/lib/extension-runtime.ts`
- `src/lib/extension-selector-pack.ts`
- `src/app/api/ext/campaigns/media/route.ts`

**Archivos reflejados también dentro del repo web para la extensión:**
- `apps/chrome-extension/recalc-sidepanel/panel.html`
- `apps/chrome-extension/recalc-sidepanel/panel.css`
- `apps/chrome-extension/recalc-sidepanel/panel.js`
- `apps/chrome-extension/recalc-sidepanel/campaigns.js`
- `apps/chrome-extension/recalc-sidepanel/content-whatsapp.js`
- `apps/chrome-extension/recalc-sidepanel/background.js`

---

## Validaciones realizadas

### 1) Validación de JavaScript de la extensión
Se verificó sintaxis con Node en:
- `panel.js`
- `campaigns.js`
- `content-whatsapp.js`
- `background.js`

### 2) Validación de archivos TS/TSX modificados en Scholarship
Se validó parse/transpilación con `esbuild` en:
- `src/components/app/AppChrome.tsx`
- `src/components/app/AppSidebar.tsx`
- `src/components/unidep/UnidepWorkspace.tsx`
- `src/components/admin/ExtensionCampaignsClient.tsx`
- `src/lib/extension-runtime.ts`
- `src/lib/extension-selector-pack.ts`
- `src/app/api/ext/campaigns/media/route.ts`

### 3) Validación con Playwright
Se ejecutaron validaciones reproducibles sobre:
- **panel de la extensión**,
- **flujo de cálculo**,
- **mensaje previo a envío**,
- **pestañas campañas/resultados**,
- **content script de WhatsApp**.

### Resultado confirmado por Playwright
- la cotización aparece al calcular,
- el mensaje preview se genera antes del envío,
- el botón **Mandar cotización** dispara el handoff correcto,
- el content script mantiene el mensaje en una sola copia,
- el envío automático simulado pulsa enviar una sola vez.

### Limitación honesta
En este entorno **no quedó levantado el runtime completo de Next + backend + Neon** para una validación E2E real del sitio web completo con sesión real. Por eso:
- la **extensión** y el **content script** sí quedaron validados con Playwright,
- la **web** quedó validada por revisión estructural, parsing de componentes y ajuste directo sobre el código, pero la prueba Playwright full-stack del sitio debe correrse ya en su entorno local o staging.

---

## Cómo sincronizar Prisma + Neon

### Punto importante
En esta tanda de cambios **no hubo cambio de esquema Prisma** confirmado como necesario para estas correcciones visuales y de flujo. Aun así, sí conviene validar que el schema actual esté alineado con Neon.

### Variables de entorno necesarias
En `.env.local` o en el entorno de despliegue:

```bash
DATABASE_URL="prisma+postgres://..."   # o postgres:// si no usan Accelerate
DIRECT_URL="postgres://..."            # conexión directa a Neon para migrate deploy
```

Si usan Vercel/Render, definan ambas también allí.

### Validación mínima segura
```bash
npx prisma validate
npx prisma generate
```

### Si NO hubo cambios de schema
Solo validar y desplegar:

```bash
npx prisma validate
npx prisma generate
npx prisma migrate deploy
```

### Si SÍ detectan cambios pendientes de schema
Primero en local:

```bash
npx prisma migrate dev --name sync_extension_campaign_flow
```

Después subir migración y en servidor:

```bash
npx prisma migrate deploy
```

### Verificación rápida contra Neon
```bash
npm run verify:neon
```

Si el proyecto ya trae scripts de bootstrap o seed, correr solo si hace falta:

```bash
npm run seed:neon
```

---

## Secuencia recomendada para ustedes

### Opción manual
1. abrir repo de Scholarship,
2. revisar cambios,
3. validar Prisma,
4. validar Neon,
5. probar `/unidep`,
6. probar extensión descomprimida,
7. probar WhatsApp Web con sesión real,
8. luego hacer commit/push.

### Comandos sugeridos
```bash
# 1) instalar deps
npm install

# 2) validar prisma
npx prisma validate
npx prisma generate

# 3) build local si aplica
npm run build

# 4) levantar proyecto
npm run dev
```

---

## Prompt exacto para pedirle a Codex que haga la sincronización Prisma/Neon

```text
Necesito que abras una nueva rama llamada "chore/validate-neon-prisma-sync".

Trabaja sobre el repositorio de Scholarship.

Objetivo:
1. validar que el schema actual de Prisma esté sincronizado con Neon,
2. generar Prisma Client,
3. detectar si existe alguna migración pendiente,
4. si no hay cambios de schema, no inventes migraciones,
5. si sí hay diferencias reales, crea una migración con un nombre claro y reproducible,
6. deja documentado qué encontraste.

Pasos exactos:
- revisa `prisma/schema.prisma`
- revisa variables de entorno requeridas: `DATABASE_URL` y `DIRECT_URL`
- ejecuta:
  - `npx prisma validate`
  - `npx prisma generate`
- si hay cambios reales de schema pendientes, ejecuta:
  - `npx prisma migrate dev --name sync_extension_campaign_flow`
- después deja preparado el despliegue con:
  - `npx prisma migrate deploy`
- si existe el script del proyecto, ejecuta además:
  - `npm run verify:neon`

No agregues archivos binarios.
No modifiques funcionalidad ajena a Prisma/Neon.
No inventes migraciones si no son necesarias.

Finalmente crea un Pull Request con el mensaje:
"chore: validar sincronización de Prisma con Neon"
```

---

## Prompt exacto para Codex si quieren que también suba los cambios de esta tanda

```text
Necesito que abras una nueva rama llamada "feat/recalc-ui-flow-refinement".

Edita y conserva los cambios ya presentes en estos archivos:
- `src/app/globals.css`
- `src/components/app/AppChrome.tsx`
- `src/components/app/AppSidebar.tsx`
- `src/components/unidep/UnidepWorkspace.tsx`
- `src/components/admin/ExtensionCampaignsClient.tsx`
- `src/lib/extension-runtime.ts`
- `src/lib/extension-selector-pack.ts`
- `src/app/api/ext/campaigns/media/route.ts`
- `apps/chrome-extension/recalc-sidepanel/panel.html`
- `apps/chrome-extension/recalc-sidepanel/panel.css`
- `apps/chrome-extension/recalc-sidepanel/panel.js`
- `apps/chrome-extension/recalc-sidepanel/campaigns.js`
- `apps/chrome-extension/recalc-sidepanel/content-whatsapp.js`
- `apps/chrome-extension/recalc-sidepanel/background.js`

Objetivo del PR:
- refinar UI web para que siga la línea visual de la extensión,
- mover pendientes/recordatorios a una sección independiente,
- hacer sidebar sobrepuesta/contraíble,
- compactar densidad visual,
- corregir el flujo de cotización en la extensión,
- mostrar el mensaje antes de enviarlo,
- evitar el pegado triplicado en WhatsApp,
- compactar campañas/resultados/header de la extensión.

No incluyas archivos binarios.
No incluyas `tsconfig.tsbuildinfo`.

Finalmente crea un Pull Request con el mensaje:
"feat: refinar UI web y flujo de cotización/campañas en la extensión"
```

---

## Entregables
- zip corregido de la extensión,
- zip corregido de Scholarship,
- bundle de validación Playwright,
- este README.
