# WhatsApp Flow Recalc v2

## Endpoints
- `GET/POST /api/webhooks/whatsapp`: verificación, firma y recepción de mensajes, estados y `nfm_reply`.
- `POST /api/webhooks/whatsapp/flows`: endpoint cifrado para disponibilidad dinámica futura.
- `POST /api/internal/whatsapp/scheduled-actions/run`: worker autenticado para cron.

En producción se puede aplicar un rewrite para exponer `/webhooks/whatsapp` sin el prefijo `/api`.

## Despliegue
1. Aplicar `supabase/migrations/20260726080000_whatsapp_flow_runtime.sql`.
2. Ejecutar `npm run db:generate` y desplegar por Preview antes de producción.
3. Configurar Meta con HTTPS, el verify token y la suscripción de mensajes.
4. Invocar el worker cada minuto con `Authorization: Bearer $SCHEDULED_ACTIONS_WORKER_SECRET`.
5. Para seguimientos fuera de la ventana permitida, definir una plantilla aprobada en `WHATSAPP_FOLLOWUP_TEMPLATE`. Sin plantilla se crea una tarea manual.
6. `CALL_PROVIDER=none` o `manual` crea una tarea manual; no simula una llamada.

## Seguridad y auditoría
`event_id` y `message_id` son únicos. El worker usa `FOR UPDATE SKIP LOCKED`, backoff exponencial, ignora canceladas y cancela contactos dados de baja. Se rechazan campos de tarjeta, CVV, contraseña, CLABE o cuenta bancaria. No se registran secretos ni payloads sensibles completos.

## Contrato de origen
Los archivos `flow_whatsapp_recalc_v2.json` y `recalc_webhook_contract.schema.json` no estaban presentes en `main`. Se agregó un contrato compatible en `apps/web/src/contracts/`; debe compararse con el contrato canónico cuando esté disponible.
