# Campus Institucional Foundation Design

## Objetivo

Definir la base visual para rediseñar progresivamente el sitio web del monorepo ReCalc / UNIDEP sin tocar backend, autenticación, APIs, Prisma, integraciones críticas ni configuración de deploy. La foundation debe servir para sitio público, workspace operativo y admin, con una interfaz más organizada, limpia, profesional, comercial y funcional.

La dirección aprobada es **Campus institucional**: identidad UNIDEP clara, azul institucional como estructura, verde para acción o contexto positivo, superficies claras, navegación productiva y componentes sobrios con densidad controlada.

## Alcance

La primera fase debe producir un sistema visual reusable y aplicarlo por capas. El alcance permitido incluye:

- Tokens visuales: color, tipografía, espaciado, radios, bordes, sombras, focus states y estados semánticos.
- Shells visuales: header/topbar, sidebar, navegación móvil, estructura de contenido y contenedores principales.
- Componentes base: botones, inputs, selects, badges, cards, tablas, empty/loading/error states, dialog/drawer y section headers.
- Superficies públicas: landing, auth shell, legales y footer sólo desde UI/UX.
- Superficies app/admin: layout, navegación, densidad, jerarquía visual, módulos de formulario, tablas y paneles.
- Documentación técnica de migración en `docs/`.

## Fuera de Alcance

La fase foundation no debe cambiar:

- Contratos de datos, nombres de endpoints, rutas API o server actions.
- `prisma/**`, `app/api/**`, `lib/db/**`, `lib/auth/**`, `middleware.ts`, `auth.ts`, integraciones Google/Meta, `.env*` o configuración de deploy.
- Lógica de negocio, cálculo, permisos, realtime, importadores, webhooks o flujos de autenticación.
- Migración fuera de Next.js App Router.

Si una pieza visual necesita datos, debe consumir los props o contratos existentes. Si falta información, se diseña el estado vacío o fallback sin inventar backend.

## Principios Visuales

1. **Institucional primero:** UNIDEP debe sentirse presente en el primer viewport, en el shell y en los estados clave, sin convertir cada pantalla en una pieza de marketing.
2. **Claridad operativa:** workspace y admin deben priorizar lectura, navegación rápida y comparación de información sobre decoración.
3. **Comercial sin ruido:** el sitio público debe vender confianza y acceso claro, usando composición limpia, copy directo y CTAs visibles.
4. **Densidad controlada:** pantallas operativas pueden ser densas, pero con jerarquía fuerte, separación consistente y estados escaneables.
5. **Componentes antes que páginas:** primero se estabiliza el lenguaje visual; luego se aplica a cada superficie.

## Sistema Visual Aprobado

### Paleta

- `brand-primary`: `#114E6D` para topbars, navegación activa, botones primarios y énfasis institucional.
- `brand-deep`: `#0F3C55` para texto fuerte, hover profundo y fondos de alto contraste cuando sean necesarios.
- `brand-success`: `#6CB514` para acciones positivas, confirmaciones, acentos comerciales y métricas favorables.
- `success-soft`: `#EDF7E2` para paneles destacados, blocks comerciales y estados positivos suaves.
- `canvas`: `#F4F9FC` / `#F7FBFD` para fondos de app, admin y bandas suaves.
- `surface`: `#FFFFFF` para cards, formularios, tablas y módulos principales.
- `border`: rango `#D7E4ED` con variaciones más fuertes sólo en tablas o separadores críticos.

La interfaz no debe volverse monocromática azul. El azul define estructura, el verde dirige acción y los fondos claros sostienen limpieza.

### Tipografía

- Mantener Geist Sans como fuente principal y Geist Mono para identificadores, códigos, timestamps y datos técnicos.
- H1 público: fuerte y comercial, sin escalar por viewport de forma extrema.
- Títulos de panel y módulos: compactos, entre `16px` y `24px` según contexto.
- Labels, tabs, navegación y controles: tamaño deliberado, no heredado del navegador.
- Letter spacing en `0`; evitar tracking negativo.

### Geometría y Espaciado

- Radio base de cards y panels: `8px`.
- Radio de botones, inputs y controles: `6px` a `8px`.
- Evitar cards dentro de cards cuando sea posible; usar secciones, bands, rows, tablas o paneles claros.
- Sombras mínimas y funcionales. Preferir borde y separación por fondo antes que elevación pesada.
- Espaciado de shells con gutters constantes; contenido operativo debe poder escanearse en laptops y móviles.

## Shells

### Workspace y Admin

El shell operativo usa:

- Topbar institucional azul con título de área, breadcrumbs compactos y acciones de perfil.
- Sidebar clara con logo/brand visible, grupos legibles, item activo en azul y hover/focus evidente.
- Fondo de contenido claro (`canvas`) con módulos blancos.
- Navegación móvil en drawer con la misma jerarquía que desktop.
- Anuncios/CTAs configurables integrados sin romper ritmo ni competir con navegación principal.

El shell no debe cambiar permisos, condiciones de acceso, redirects, ni lógica de desbloqueo admin. Sólo se ajusta estructura visual y composición.

### Público

El sitio público usa la misma paleta, pero con ritmo más comercial:

- Header simple con marca visible y CTAs claros.
- Hero con UNIDEP/ReCalc como señal de primer viewport.
- Beneficios sin emojis como iconografía principal; usar iconos consistentes o componentes visuales nativos.
- Secciones con variación de ritmo: hero, beneficios, capacitación, confianza/legal/footer.
- CTAs con jerarquía clara: acción principal azul, acción secundaria en superficie clara.

## Componentes Base

### Botones

- Primario: azul institucional, texto blanco, hover profundo, focus ring visible.
- Secundario: superficie blanca, borde institucional suave, texto azul profundo.
- Positivo: verde sólo cuando la acción o estado sea realmente positivo.
- Danger: rojo semántico, aislado de la paleta de marca.

### Forms

- Inputs/selects con fondo blanco, borde visible, focus ring azul y error state consistente.
- Labels siempre visibles y legibles.
- Ayudas o errores en texto compacto, sin depender sólo de color.

### Cards y Panels

- Cards blancas con borde claro, radio `8px` y sombra muy ligera.
- Panels destacados pueden usar `success-soft` o `canvas`, pero deben conservar contraste.
- Métricas y summaries usan jerarquía tipográfica, no sólo tamaño o color.

### Tablas

- Mantener tablas para datos densos; no convertir todo a cards.
- Header con fondo claro institucional, filas con separación sutil, hover legible y acciones alineadas.
- Anchos mínimos estables para evitar saltos y overflow accidental.

### Estados

- Empty states con copy breve y acción contextual.
- Loading states con skeletons o bloques estables, no texto suelto que cambie layout.
- Error states con explicación corta, acción recuperable y color semántico.

## Arquitectura de Implementación

1. Consolidar tokens en `apps/web/src/app/globals.css` y `packages/ui/src/theme/tokens.ts`, manteniendo compatibilidad con clases existentes.
2. Actualizar primitivos en `packages/ui/src/components/primitives.tsx` para que reflejen el sistema Campus institucional.
3. Refactorizar shells visuales en `apps/web/src/components/app/**`, `apps/web/src/components/layout/**` y componentes admin/layout permitidos.
4. Aplicar el sistema al sitio público en `apps/web/src/components/public/**`.
5. Revisar pantallas app/admin por rutas en lotes, priorizando navegación, formularios y tablas sobre detalles decorativos.

Los cambios deben ser incrementales. Cada lote debe poder pasar `npm run lint`, `npm run typecheck` y `npm run build`.

## Data Flow y Contratos

La foundation no introduce nuevas fuentes de datos. Los componentes reciben los mismos props y renderizan los mismos estados. Si un componente actual mezcla UI con llamadas o lógica, la fase foundation sólo puede extraer subcomponentes visuales cuando no cambia el comportamiento.

Para CTAs, anuncios, permisos y navegación:

- Mantener keys, hrefs, aliases y filtros existentes.
- No cambiar nombres de capability ni reglas de acceso.
- No alterar redirects de auth ni server components que resuelven sesión.

## Accesibilidad

- Focus visible en todos los controles interactivos.
- Contraste suficiente en azul, verde y estados semánticos.
- Estados activos con más de una señal cuando sea necesario: color, borde, peso o indicador.
- Navegación móvil con labels accesibles y foco manejable.
- Textos sin overlap ni truncamiento crítico en móvil.

## Verificación

Cada lote de implementación debe verificar:

- `npm run lint`
- `npm run typecheck`
- `npm run build`
- Browser QA en desktop y móvil para sitio público, workspace y al menos una pantalla admin representativa.
- Revisión visual de layout, responsive, contraste, espaciado, hover/focus y consistencia de branding.

La comparación visual debe confirmar que el resultado sigue Campus institucional: marca visible, azul estructural, verde contextual, fondos claros, navegación productiva y componentes limpios.

## Plan de Rollout

1. Foundation tokens y primitivos UI.
2. Shell workspace/admin y navegación.
3. Landing pública y auth/legal shells.
4. Componentes densos: tablas, forms, panels y states.
5. Barrido de pantallas prioritarias por módulo.
6. QA visual y documentación de decisiones finales.

## Criterios de Aceptación

- La UI se percibe como Campus institucional en público, workspace y admin.
- No hay cambios en backend, auth, APIs, Prisma, integraciones críticas ni deploy config.
- Los contratos de datos y rutas existentes se preservan.
- Los componentes base se reutilizan en vez de duplicar estilos por pantalla.
- Lint, typecheck y build pasan antes de cerrar cada lote.
- El resultado mejora claridad, organización, profesionalismo comercial y funcionalidad operativa.
