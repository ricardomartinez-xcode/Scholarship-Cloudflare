# WhatsApp media caption selector fix - 2026-06-18

## Objetivo

Permitir que las campañas de la extension ReCalc Sender envien imagenes por WhatsApp Web con el texto de campana como caption del adjunto, evitando que el flujo caiga a sticker o a mensaje de texto separado.

## Causa encontrada

El flujo fallaba en el preview de adjuntos porque WhatsApp Web cambio el DOM del caption y del boton final de envio:

- El caption actual puede aparecer como `data-testid="media-caption-input-container"` o con `aria-placeholder="Escribe un mensaje"`.
- El boton del preview puede aparecer como `aria-label="Enviar 1 seleccionado"`.
- El menu de adjuntos puede ocultar texto accesible y exponer el icono `ic-filter-filled` para `Fotos y videos`.
- Si el backend mandaba un `selectorPack` anterior, la extension lo tomaba como override completo y borraba los fallbacks locales nuevos.

## Cambios aplicados

- `apps/chrome-extension/recalc-sidepanel/lib/whatsapp/wa-selectors.js`
  - Agrega selectores actuales para caption de media y boton `Enviar ... seleccionado`.
  - Usa `ic-filter-filled` como señal adicional de la opcion `Fotos y videos`.
  - Fusiona selector pack remoto con defaults locales, deduplicando selectores.

- `apps/chrome-extension/recalc-sidepanel/content-whatsapp.js`
  - Actualiza el flujo legacy con los mismos selectores de caption/envio.
  - Fusiona selector pack remoto con defaults locales.

- `apps/web/src/lib/extension-selector-pack.ts`
  - Actualiza el selector pack backend a `waweb-2026.06.18-media-caption-03`.
  - Fusiona configuraciones guardadas antiguas con defaults actuales.

- `apps/web/src/lib/extension-runtime.ts`
  - Actualiza runtime policy a `2026-06-18.caption-selector-v1`.
  - Requiere extension `6.3.4`.

- `apps/chrome-extension/recalc-sidepanel/manifest.json`
  - Sube version a `6.3.4`.

- Pruebas:
  - Regression tests para caption actual, boton `Enviar 1 seleccionado` y selector pack remoto obsoleto.
  - E2E dry-run actualizado para buscar los nuevos selectores de caption.

## Validacion real

Se ejecuto un dry-run real en Chrome contra WhatsApp Web:

- Destino abierto: `5573578665`.
- Opcion detectada: `Fotos y videos`.
- Input elegido: `image/*,video/mp4,video/3gpp,video/quicktime`.
- Caption escrito en preview: `Prueba ReCalc 6.3.4 caption selector`.
- No se presiono Enviar durante el dry-run.
- Evidencia local: `output/playwright/whatsapp-live-dry-run/preview-caption-ready.png`.

El 2026-06-20 se completo la validacion con envio real:

- Destino validado en WhatsApp Web: busqueda por `5573578665`, chat resuelto como `Ricardo Martinez Hernandez`.
- Imagen enviada: `apps/chrome-extension/recalc-sidepanel/icons/icon128.png`.
- Caption enviado dentro del adjunto: `Prueba ReCalc 6.3.4 caption selector`.
- Evidencia local limpia: `output/playwright/whatsapp-live-send/sent-clean-evidence-5573578665.png`.
- El preview diagnostico pendiente se cerro sin enviar duplicados.
- ZIP entregado en Escritorio: `C:\Users\ricar\OneDrive\Desktop\recalc-sidepanel-v6.3.4.zip`.

Durante la validacion real se confirmo que WhatsApp Web puede ignorar clicks sinteticos del content script sobre `Adjuntar`. El flujo de campanas con media usa la ruta con `chrome.debugger` en `background.js`, que dispara clicks reales via CDP, intercepta el file chooser y despues aplica el caption en el preview antes de presionar el boton final.

## Resultado

El selector ya encuentra el preview actual de WhatsApp, escribe el caption dentro del adjunto y mantiene el guardrail de no elegir stickers como media.
