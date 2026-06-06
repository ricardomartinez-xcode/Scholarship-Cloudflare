# Bots locales para rolplay de ventas

La pantalla `/unidep/capacitacion/rolplay` incluye dos bots locales sin API de IA:

- `closing`: prospecto interesado que acepta avanzar si el asesor resuelve la objecion.
- `non_closing`: prospecto realista que pide tiempo, compara opciones o evita cerrar.

## Donde se configuran

El motor vive en:

`apps/web/src/lib/sales-roleplay-bots.ts`

Los perfiles estan en `ROLEPLAY_BOT_CONFIGS` y cada bot define:

- `openers`: como abre la respuesta por tipo de objecion.
- `challenges`: pregunta incomoda o duda realista para el asesor.
- `nextMoves`: siguiente reaccion del prospecto.
- `intent`: si el bot se mueve a cierre o resiste cierre.

Las objeciones soportadas son:

- `price`
- `schedule`
- `trust`
- `comparison`
- `family`
- `urgency`
- `documents`
- `default`

## Como agregar conocimiento

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

El motor toma esas lineas primero y despues cae a la base precargada. No llama modelos, no usa `fetch` y no envia respuestas automaticamente; solo genera un borrador que puede colocarse en el composer.
