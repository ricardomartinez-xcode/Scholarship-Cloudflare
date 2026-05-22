# Auditoría: `recalc-scholarship-integration`

Fecha: 2026-03-23

## Resumen ejecutivo

La carpeta [C:\Users\ricar\OneDrive\Desktop\recalc-scholarship-integration](C:\Users\ricar\OneDrive\Desktop\recalc-scholarship-integration) no es el estado real del producto. Es un kit paralelo para una fase 2 de integración entre la extensión de ReCalc y una automatización de WhatsApp Web.

El repo principal ya resolvió una parte importante de la extensión por otra vía:

- side panel MV3 productivo;
- autenticación por token de sesión de Neon Auth en header;
- sincronización viva con el backend real;
- branding y assets para Chrome Web Store;
- configuración remota del header del panel desde admin.

La carpeta auditada intenta añadir otra capa:

- `POST /api/ext/token`;
- `GET /api/ext/bootstrap`;
- `POST /api/ext/runs`;
- `POST /api/ext/runs/[runId]/events`;
- selector pack para WhatsApp Web;
- apertura de WhatsApp Web desde la extensión.

## Qué se estaba buscando hacer

El objetivo técnico del spike era preparar una fase 2 donde la extensión no solo cotiza, sino que también:

1. obtenga un token dedicado para la extensión desde una sesión web válida;
2. cargue un bootstrap técnico para capacidades extra;
3. registre runs y eventos de uso;
4. sirva como punto de entrada hacia WhatsApp Web.

## Hallazgos

### 1. El spike no es integrable tal cual

Problemas detectados:

- el backend de `apps/web` es un scaffold, no una integración real;
- `POST /api/ext/token` usa un stub con usuario hardcodeado;
- el paquete no trae configuración real de Next.js, TypeScript ni build del proyecto principal;
- las rutas usan imports que no coinciden con la estructura del repo actual;
- la propuesta JWT duplica una capa de auth que el repo ya resolvió con `x-extension-session-token`.

### 2. La intención del spike sí es válida

Lo valioso del spike es la dirección funcional:

- bootstrap técnico para la extensión;
- telemetría de runs/eventos;
- handoff a WhatsApp Web;
- selector pack versionado para una futura automatización.

### 3. El repo principal ya tiene piezas equivalentes o mejores

- Auth de extensión real: [C:\Users\ricar\Scholarship\src\lib\extension-auth.ts](C:\Users\ricar\Scholarship\src\lib\extension-auth.ts)
- Session validation real: [C:\Users\ricar\Scholarship\src\lib\authz.ts](C:\Users\ricar\Scholarship\src\lib\authz.ts)
- Side panel productivo: [C:\Users\ricar\Scholarship\apps\chrome-extension\recalc-sidepanel](C:\Users\ricar\Scholarship\apps\chrome-extension\recalc-sidepanel)
- Configuración remota del panel: [C:\Users\ricar\Scholarship\src\app\api\extension\panel-config\route.ts](C:\Users\ricar\Scholarship\src\app\api\extension\panel-config\route.ts)
- Templates y preview de WhatsApp: [C:\Users\ricar\Scholarship\src\lib\whatsapp-templates.ts](C:\Users\ricar\Scholarship\src\lib\whatsapp-templates.ts)

## Decisión aplicada

En vez de copiar el spike dentro del repo, se integró solo la parte útil dentro de la arquitectura real:

- soporte a `Authorization: Bearer <token>` usando el mismo token seguro de extensión;
- rutas nuevas `api/ext/*` compatibles con el spike;
- bootstrap de extensión;
- tracking de runs y eventos usando `BusinessEvent`;
- handoff real a WhatsApp Web desde el panel;
- render de borrador desde backend usando el template activo del usuario;
- selector pack administrable desde el panel admin;
- content script limitado a `web.whatsapp.com` para pegar el borrador en el composer sin enviarlo automáticamente;
- empaquetado repetible para Chrome.

## Mejoras de diseño y arquitectura recomendadas

### Mantener

- una sola extensión oficial;
- un solo backend;
- una sola fuente de autenticación;
- branding compartido entre web y side panel.

### Mantener bajo control

- content script sólo en `web.whatsapp.com`;
- sin envío automático de mensajes;
- sin lectura masiva de chats o historial;
- sin permisos `tabs`, `cookies` o `scripting` mientras no sean estrictamente necesarios;
- sin duplicar auth con JWT separado si el token seguro actual ya resuelve el problema.

### Próxima fase recomendable

La siguiente fase correcta, si se quiere ir más allá del borrador asistido, es:

1. agregar canal `stable / beta` para selector pack;
2. crear feature flags por organización o por usuario;
3. definir con precisión qué acciones adicionales se automatizan;
4. mantener cada nueva capacidad detrás de trazabilidad en `BusinessEvent`.

## Conclusión

La carpeta auditada no debe subirse ni fusionarse como está. Funciona como referencia de intención, no como base segura de producción.

La implementación útil ya debe vivir en el repo principal, y la ruta correcta es extender la extensión actual, no reemplazarla por otro scaffold. Eso es lo que quedó aplicado.
