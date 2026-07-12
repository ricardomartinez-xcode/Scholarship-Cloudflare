# Modo temporal: Neon Auth legado por invitacion

Este cambio deshabilita temporalmente las integraciones nuevas de OAuth externo, webhooks reenviados, Meta, Google y WhatsApp.

## Flujo activo

1. Un administrador crea una invitacion desde `/admin/invitations`.
2. El sistema envia correo si SMTP esta configurado o permite copiar el link.
3. El usuario completa el alta con Neon Auth desde el link.
4. El webhook publico `/api/integrations/neon-auth/webhook` queda limitado a:
   - `user.before_create` -> permite crear cuenta.
   - `send.otp` -> envia codigo por correo si SMTP existe.
   - `send.magic_link` -> envia link por correo si SMTP existe.

## Integraciones deshabilitadas

- Google OAuth connect/callback.
- Meta OAuth / embedded signup / code exchange.
- Meta webhook / conversions / WhatsApp.
- Panel administrativo de OAuth provider y configuracion avanzada de webhooks Neon Auth.

## Reversion

Para reactivar integraciones nuevas, restaurar los route handlers reemplazados en este cambio y volver a exponer el panel administrativo correspondiente.
