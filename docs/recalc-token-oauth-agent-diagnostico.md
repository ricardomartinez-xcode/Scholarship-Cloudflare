# Recalc: tokens, OAuth y esquemas de API/agentes

Fecha de diagnóstico: 2026-06-03

## Hallazgos principales

### 1. TTL de tokens de extensión

El límite de 24 horas venía de `apps/web/src/lib/extension-session-tokens.ts`:

- `MAX_TTL_MS` estaba fijado en 24 horas.
- `DEFAULT_TTL_MS` heredaba ese máximo.
- El endpoint JSON de `/api/extension/auth/sign-in` emitía tokens sin permitir elegir duración.

El cambio propuesto deja el esquema actual de tokens intacto: siguen siendo opacos, revocables, se guardan hasheados y se validan contra `revokedAt` + `expiresAt`.

Duraciones soportadas:

| Valor | Duración efectiva |
| --- | --- |
| `24h` | 24 horas |
| `7d` | 7 días |
| `30d` | 30 días |
| `365d` | 1 año |
| `never` | fecha centinela `9999-12-31T23:59:59.000Z` |

El valor `never` no elimina `expiresAt` del modelo para evitar una migración de base de datos. Funciona como “no expira operacionalmente”, pero sigue siendo revocable.

### Contrato de API

`POST /api/extension/auth/sign-in`

```json
{
  "email": "usuario@dominio.com",
  "password": "********",
  "sessionDuration": "7d"
}
```

Aliases aceptados:

- `sessionDuration`
- `tokenDuration`
- `extensionSessionDuration`
- `ttlMs` para compatibilidad numérica

Respuesta nueva:

```json
{
  "ok": true,
  "email": "usuario@dominio.com",
  "next": "/extension",
  "extensionSessionToken": "rx_ext_...",
  "expiresAt": "2026-06-10T00:00:00.000Z",
  "sessionDuration": "7d",
  "sessionTtlMs": 604800000
}
```

Para `never`, `sessionTtlMs` regresa `null`.

## Recomendaciones de seguridad para tokens largos

- No usar `never` como default.
- Mantener un panel para revocar sesiones por usuario, cliente y scope.
- Mostrar `lastUsedAt`, `createdAt`, `client`, `extensionVersion` y `userAgent`.
- Rotar token en cada inicio de sesión por scope + cliente, como ya hace el código.
- Agregar alerta cuando un token de 365 días o `never` se usa desde un agente de usuario distinto.

## OAuth para salida de correos / Google

Estado observado en el repo:

- Los endpoints `/api/integrations/google/connect` y `/api/integrations/google/callback` están deshabilitados con `503`.
- El modelo `UserGoogleConnection` sí existe en Prisma y ya contempla tokens cifrados, refresh token, scopes, estado y expiración.
- Esto sugiere que el flujo fue pausado por estabilidad/seguridad, no que falte todo el modelo de datos.

Riesgos y causas probables cuando se reactive:

1. Si el proyecto OAuth está en modo externo `Testing`, Google emite refresh tokens de 7 días para scopes no básicos.
2. Si no se pide `access_type=offline`, no hay refresh token para acciones en background.
3. Si no se fuerza consentimiento cuando hace falta, Google puede no devolver refresh token en reconexiones.
4. Si el usuario cambia contraseña y el token tiene scopes de Gmail, el refresh token puede dejar de funcionar.
5. Si el callback sobrescribe `encryptedRefreshToken` con `null` cuando Google no devuelve refresh token, rompe conexiones que ya funcionaban.
6. Si hay mismatch de redirect URI o dominio, el callback falla aunque el código esté bien.

Reactivación recomendada:

1. Verificar estado del OAuth consent screen: mover a producción si ya está listo.
2. Confirmar redirect URI exacta de producción.
3. Implementar connect con `access_type=offline`, `include_granted_scopes=true` y `prompt=consent` solo cuando se necesite refresh token nuevo.
4. En callback, conservar refresh token anterior si Google no regresa uno nuevo.
5. Agregar endpoint de diagnóstico por usuario: estado, scopes, expiración, último error y botón de reconectar.
6. Manejar `invalid_grant` como reconexión guiada, no como error genérico.

## Usuarios que ya tenían cuenta

Estado observado:

- `sign-up` detecta errores de cuenta existente y redirige a `sign-in`.
- `authz.syncUserRecord()` busca usuario por `authUserId` o por email; si encuentra por email, puede actualizar `authUserId`.
- `invite/accept` consume la invitación solo después de iniciar sesión.

Mejora recomendada:

- Convertir invitaciones en flujo idempotente:
  - si la cuenta no existe, crearla;
  - si existe, mandar a login;
  - si login es correcto, consumir invitación automáticamente;
  - si password fue olvidado, mostrar recuperación;
  - si cuenta existe en auth pero no en `User`, sincronizar en primer login.
- Agregar mensajes diferenciados:
  - “Cuenta existente, inicia sesión para aceptar invitación.”
  - “Cuenta existente pero no verificada, reenvía verificación.”
  - “Cuenta existente sin contraseña conocida, restablece contraseña.”

## Esquemas de API/agentes

### A. API auditadora y reparadora

Objetivo: detectar fallas reales y proponer o aplicar correcciones controladas.

Endpoints sugeridos:

- `POST /api/agents/auditor/diagnose`
- `POST /api/agents/auditor/repair-plan`
- `POST /api/agents/auditor/create-patch`
- `POST /api/agents/auditor/verify`

Niveles de permiso:

- `read_only`: solo diagnostica.
- `suggest_patch`: prepara diff.
- `create_pr`: abre PR.
- `apply_safe_config`: aplica cambios de configuración permitidos.
- `break_glass`: reservado para owner con confirmación explícita.

### B. Agente de texto para ventas y roleplay

Objetivo: practicar conversaciones, objeciones, cierres, seguimiento y tono comercial.

Componentes:

- Base de conocimiento de programas, campus, precios, becas y objeciones.
- Motor de escenarios: prospecto frío, indeciso, comparación, objeción de precio, seguimiento.
- Evaluador: empatía, claridad, precisión, cierre, cumplimiento.
- Historial de sesiones y feedback por asesor.

Endpoints sugeridos:

- `POST /api/agents/sales-roleplay/start`
- `POST /api/agents/sales-roleplay/message`
- `POST /api/agents/sales-roleplay/evaluate`

### C. Optimizador de procesos

Objetivo: detectar cuellos de botella y mejoras operativas.

Fuentes:

- Auditoría administrativa.
- Eventos de cotización.
- Fallas de importación.
- Uso de CTAs.
- Conversaciones/roleplay cuando aplique.

Salidas:

- Lista priorizada de mejoras.
- Impacto esperado.
- Riesgo.
- Responsable sugerido.
- Métrica de éxito.

Endpoints sugeridos:

- `POST /api/agents/process/analyze`
- `POST /api/agents/process/recommend`
- `POST /api/agents/process/track`

### D. Asistente cotidiano

Objetivo: operar Recalc por lenguaje natural con acciones seguras.

Capacidades:

- Consultar ofertas, ciclos y cotizaciones.
- Diagnosticar casos.
- Preparar importaciones.
- Explicar cambios.
- Generar reportes.
- Ejecutar acciones solo con confirmación.

Endpoints sugeridos:

- `POST /api/assistant/chat`
- `POST /api/assistant/actions/preview`
- `POST /api/assistant/actions/confirm`

## Principio de diseño

Los cuatro esquemas pueden compartir una misma base:

- Autenticación por sesión o token de agente.
- Scopes por rol.
- Auditoría obligatoria.
- Confirmación para operaciones destructivas.
- Trazabilidad de entrada, decisión, acción y resultado.
