CAMBIOS APLICADOS

Se modificaron estos archivos de la extensión:

1) background.js
   - Normaliza el Content-Type recibido del backend.
   - Rechaza imágenes no compatibles con WhatsApp: por ejemplo image/x-icon/.ico.
   - Permite sólo image/jpeg, image/png e image/webp.

2) lib/whatsapp/wa-attachments.js
   - Evita tratar cualquier image/* como media válida.
   - Permite sólo JPG, PNG y WEBP como imágenes adjuntas.

Después de reemplazar/cargar la extensión:
- Abre chrome://extensions
- Activa Modo desarrollador
- Carga la carpeta descomprimida o pulsa Recargar en la extensión existente

Importante:
La campaña actual todavía apunta a campana-extension.ico. Debes volver a subir la imagen como PNG, JPG o WEBP.
