# ReCalc Sender 10.7.0 — Validación multimedia y secuencial

Fecha: 2 de agosto de 2026 (America/Mexico_City)

## Cambios verificados

- Única fuente oficial: `chrome-extension/variants/preview-first`.
- Eliminadas las variantes y paquetes 10.2.0, 10.3.1 y Premium-Sender-Backend.
- Imágenes admitidas: JPG, PNG y WEBP.
- Videos admitidos: MP4 y WEBM, máximo 32 MB.
- Selección exclusiva de **Fotos y videos** por nombre.
- Eliminado el fallback por posición que podía seleccionar Sticker.
- Bloqueo explícito de opciones e inputs compatibles con Sticker.
- Envío multimedia con texto como caption o sin texto.
- WhatsApp se crea o reutiliza como pestaña inactiva.
- La pausa conserva batch e índice del destinatario pendiente.
- Pausa entre mensajes dentro del lote.
- Pausa entre lotes al terminar el último destinatario del batch.

## Pruebas automatizadas

- Reanudación del mismo batch sin repetir ni saltar destinatarios: PASS.
- Delay de mensaje dentro del batch: PASS.
- Delay de lote al cerrar el batch: PASS.
- Bloqueos anti-sticker en ruta principal y ruta heredada: PASS.
- Clasificación de imagen/video como multimedia: PASS.
- Apertura de WhatsApp en segundo plano: PASS.
- Sintaxis de todos los JavaScript de la extensión: PASS.
- ESLint de endpoints multimedia: PASS.

## Validación sobre WhatsApp Web real

- Sesión autenticada: confirmada.
- Menú real observado: Document, Photos & videos, Camera, Audio, Contact, Poll, Event y New sticker.
- La automatización 10.7.0 solo acepta la opción `Photos & videos` y bloquea `New sticker`.
- El controlador Remote Chrome devolvió `manual_upload_required`: Chrome exige que el archivo sea elegido localmente. No se envió contenido a terceros durante la inspección.
- La extensión evita esa limitación: descarga el asset autenticado desde ReCalc/Supabase, reconstruye un `File` y lo asigna con `DataTransfer` al input validado de Fotos y videos.

## Resultado

La lógica de envío, pausas y reanudación queda validada. No se afirma una prueba visual real de cuatro adjuntos desde Remote Chrome porque el controlador no puede elegir archivos locales.
