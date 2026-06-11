# Bots locales para rolplay de ventas

La pantalla `/unidep/capacitacion/rolplay` incluye dos bots locales sin API de IA:

- `closing`: prospecto interesado que acepta avanzar si el asesor resuelve la objecion.
- `non_closing`: prospecto realista que pide tiempo, compara opciones o evita cerrar.

El panel de la practica permite agregarlos como participante del chat y deja activa la respuesta automatica por defecto. Cuando el asesor envia un mensaje, el bot seleccionado responde dentro del chat mediante `/api/capacitacion/chats/[chatId]/bots/messages`.

## Donde se configuran

El motor vive en:

`apps/web/src/lib/sales-roleplay-bots.ts`

Los perfiles estan en `ROLEPLAY_BOT_CONFIGS` y cada bot define:

- `openers`: como abre la respuesta por tipo de objecion.
- `challenges`: pregunta incomoda o duda realista para el asesor.
- `nextMoves`: siguiente reaccion del prospecto.
- `intent`: si el bot se mueve a cierre o resiste cierre.

El panel admin esta en:

`/admin/capacitacion/bots`

## Base de conocimiento

Para conocimiento fijo, agrega entradas en `PRELOADED_ROLEPLAY_KNOWLEDGE`:

```ts
{
  topic: "beca",
  detail: "La beca debe explicarse con vigencia y monto confirmado.",
  triggers: ["beca", "descuento", "mensualidad"],
}
```

Para conocimiento temporal, usa el campo `Conocimiento extra` del panel. Acepta una linea por dato:

```txt
Beca: Se puede apartar con documentos completos.
Horarios: Hay turnos ejecutivos para quien trabaja.
RVOE: Validar programa antes de pedir documentos.
```

El motor toma esas lineas primero y despues cae a la base precargada. No llama modelos externos y no envia datos fuera de Scholarship.

## Bot avanzado por API

El admin general muestra el acceso a `/admin/capacitacion/bots`. La preparacion para un bot avanzado se valida con:

```txt
ROLEPLAY_ADVANCED_BOT_API_URL=...
ROLEPLAY_ADVANCED_BOT_API_KEY=...
ROLEPLAY_ADVANCED_BOT_PROVIDER=custom
ROLEPLAY_ADVANCED_BOT_MODEL=...
```

La app solo muestra si esas variables estan configuradas; no expone secretos al navegador.
