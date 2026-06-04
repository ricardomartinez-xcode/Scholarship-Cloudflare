# Roleplay y asistente operativo MVP

## Alcance

Este cambio agrega dos modulos internos sin migraciones Prisma ni acciones destructivas:

- Bot guionado para rolplay comercial en `/unidep/capacitacion/rolplay`.
- Asistente operativo cotidiano en `/admin/operations/assistant`.

El bot de rolplay no usa `OPENAI_API_KEY`. Responde con un catalogo local de
intenciones, ejemplos y respuestas predeterminadas. El asistente operativo si usa
el wrapper comun `apps/web/src/lib/ai/client.ts`; si `OPENAI_API_KEY` no esta
configurada, responde con fallback determinista.

## Modulo 2: bot guionado de roleplay

Archivos principales:

- `apps/web/src/lib/training-roleplay-agents.ts`
- `apps/web/src/app/api/capacitacion/agents/route.ts`
- `apps/web/src/app/api/capacitacion/chats/[chatId]/agents/route.ts`
- `apps/web/src/app/api/capacitacion/chats/[chatId]/agent-reply/route.ts`
- `apps/web/src/app/api/capacitacion/chats/[chatId]/agent-evaluation/route.ts`
- `apps/web/src/components/capacitacion/RolplayWorkspace.tsx`

El modulo reutiliza los modelos existentes `TrainingRoom`, `TrainingChat`,
`TrainingRoomMember`, `TrainingChatParticipant`, `TrainingMessage` y
`TrainingFeedback`. No agrega tablas. El agente vive como usuario interno con
email `sales-roleplay-agent@system.recalc.local` y se agrega como miembro de la
sala y participante del chat cuando un moderador/admin lo activa.

Al agregarlo a un chat, la configuracion se guarda en
`TrainingRoomMember.anonymousAlias` con prefijo `roleplay-agent`, sin migracion:

- `mode`: modo del bot.
- `difficulty`: `basica`, `media` o `dificil`.
- `scenario`: escenario puntual del ejercicio.
- `extraInstructions`: guiones, ejemplos u objeciones adicionales.

Cuando una persona real envia un mensaje en un chat abierto donde el bot esta
agregado, la ruta de mensajes intenta crear automaticamente la siguiente
respuesta guionada y la emite por realtime. Si el bot no puede responder, el
mensaje humano no se bloquea.

Modos MVP:

- `prospecto_indeciso`
- `prospecto_objecion_precio`
- `prospecto_comparando_escuelas`
- `coach_ventas`
- `evaluador`

Permisos:

- La lectura del catalogo requiere sesion valida.
- Alta, baja, respuesta y evaluacion requieren `canManageChats` del contexto de
  la sala de capacitacion.
- Las mutaciones usan `checkRateLimit` y escriben `AdminAuditLog`.
- La respuesta automatica se dispara al enviar mensajes normales del chat; no
  requiere API key ni consume OpenAI.

## Modulo 3: asistente operativo cotidiano

Archivos principales:

- `apps/web/src/lib/agents/operations-assistant.ts`
- `apps/web/src/app/api/assistant/operations/capabilities/route.ts`
- `apps/web/src/app/api/assistant/operations/chat/route.ts`
- `apps/web/src/app/api/assistant/operations/action-preview/route.ts`
- `apps/web/src/app/api/assistant/operations/action-confirm/route.ts`
- `apps/web/src/components/admin/OperationsAssistantPanel.tsx`
- `apps/web/src/app/(admin)/admin/(protected)/operations/assistant/page.tsx`
- `apps/web/src/config/dashboard-navigation.ts`

El asistente consulta contexto operativo read-only:

- Estado del rate limiter.
- Readiness del cotizador.
- Ultima importacion admin.
- Eventos recientes de `AdminAuditLog`.
- Conteo de oferta activa.

Acciones MVP:

- `create_audit_note`: registra una nota operativa en `AdminAuditLog`.
- `review_offer_imports`: disponible como preview no destructivo.
- `document_env_setup`: disponible como preview no destructivo.

Todas las acciones confirmables requieren escribir `CONFIRMAR`.

Permisos:

- APIs y pagina requieren `AdminCapability.view_admin_operations`.
- Las rutas aplican `checkRateLimit`.

## Variables relevantes

OpenAI:

- `OPENAI_API_KEY`: opcional para el asistente operativo. No se usa en rolplay.
- `OPENAI_MODEL`: opcional. Default local: `gpt-4.1-mini`.

GitHub para Auditor/Reparador:

- `GITHUB_TOKEN`
- `GITHUB_OWNER`
- `GITHUB_REPO`
- `GITHUB_DEFAULT_BRANCH` opcional

Rate limit compartido:

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

Base de datos/Auth:

- `DATABASE_URL`
- `DIRECT_URL`
- `NEON_AUTH_BASE_URL`
- `NEON_AUTH_COOKIE_SECRET`

Realtime de capacitacion:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_URL` opcional si difiere del public URL
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_REALTIME_JWT_SECRET`

Google OAuth, si se reactiva:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_OAUTH_REDIRECT_URI`
- `GOOGLE_INTEGRATION_SECRET`
- `GOOGLE_OAUTH_STATE_SECRET` opcional si se separa del secret de integracion

## Pruebas enfocadas

```bash
npm test -- apps/web/src/lib/ai/__tests__/client.test.ts apps/web/src/lib/__tests__/training-roleplay-agents.test.ts apps/web/src/lib/agents/__tests__/operations-assistant.test.ts
```

Checklist completo del repo antes de cerrar:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## Rollback

Revertir el commit del PR. No hay migraciones ni cambios destructivos.
