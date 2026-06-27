# Seguridad de autenticación Cloudflare

La autenticación nativa de Cloudflare usa sesiones D1, cookies `HttpOnly` y contraseñas PBKDF2-HMAC-SHA256.

## Protección de contraseñas

- Las cuentas nuevas requieren al menos 12 caracteres y admiten un máximo de 128.
- Los hashes nuevos usan 600,000 iteraciones PBKDF2-SHA256.
- Los hashes heredados compatibles se fortalecen automáticamente después de un inicio de sesión exitoso.
- El endpoint de acceso no diferencia entre correo inexistente, cuenta inactiva o contraseña incorrecta.

## Limitación de intentos

La migración `0010_cloudflare_auth_rate_limit.sql` añade contadores D1 de 15 minutos:

- 5 intentos fallidos por combinación correo/IP.
- 25 intentos fallidos por IP.

Los identificadores se guardan únicamente como hashes. Para evitar ataques de diccionario sobre una copia de D1, configura un secreto único de producción:

```bash
wrangler secret put CLOUDFLARE_AUTH_RATE_LIMIT_PEPPER
```

El Worker elimina contadores expirados mediante el Cron Trigger horario. Este mecanismo complementa, pero no sustituye, las reglas de WAF/rate limiting y Turnstile administradas en Cloudflare.
