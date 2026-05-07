# Diseño: Refactor Sistema de Templates WhatsApp

**Fecha:** 2026-03-09
**Estado:** Aprobado
**Alcance:** Migración a catálogo posicional fijo + humanización de templates oficiales

---

## Contexto

El sistema actual de templates de WhatsApp usa dos mecanismos separados:
- `baseText` — texto libre con tokens nombrados (`{{campus}}`, `{{program}}`)
- `fieldOrder` — lista de campos que se añaden como sección estructurada *después* del texto

El admin no puede controlar el orden ni la presentación de las variables dentro del texto de forma natural. Los templates oficiales por defecto tienen tono genérico ("Hola, te comparto la cotización estimada:").

---

## Objetivo

Permitir que el admin escriba el mensaje completo con referencias posicionales (`{{N}}`) que se reemplazan con el valor renderizado de cada variable al mostrar el preview o al copiar el mensaje.

---

## Arquitectura

### Token System: Catálogo Posicional Fijo

Cada campo en `WHATSAPP_TEMPLATE_FIELDS` tiene un número permanente = índice 0-based + 1.

| Posición | Clave | Label |
|----------|-------|-------|
| `{{1}}` | campus | Plantel |
| `{{2}}` | program | Programa |
| `{{3}}` | business_line | Línea de negocio |
| `{{4}}` | modality | Modalidad |
| `{{5}}` | plan | Plan |
| `{{6}}` | enrollment_type | Tipo de ingreso |
| `{{7}}` | schedule | Horario |
| `{{8}}` | list_price | Precio lista |
| `{{9}}` | scholarship | Beca (completo) |
| `{{10}}` | scholarship_percent | % Beca |
| `{{11}}` | scholarship_amount | Monto beca |
| `{{12}}` | additional_benefit | Beneficio adicional (completo) |
| `{{13}}` | additional_benefit_percent | % Beneficio adicional |
| `{{14}}` | additional_benefit_amount | Monto beneficio adicional |
| `{{15}}` | first_payment | Primer pago |
| `{{16}}` | additional_charge | Cargo adicional |
| `{{17}}` | subtotal | Subtotal |
| `{{18}}` | total | Total |
| `{{19}}` | notes | Notas/Observaciones |
| `{{20}}` | call_to_action | Siguiente paso (CTA) |

Los números son permanentes. Si se agregan nuevos campos en el futuro, se añaden al final del catálogo.

### Modelo de datos (sin cambios de schema)

- `baseText` (columna existente) — almacena el mensaje con `{{N}}`
- `fieldOrder` (columna existente, tipo `Json`) — pasa de `string[]` (nombres) a `number[]` (índices usados, auto-derivados del texto al guardar)

---

## Cambios por archivo

### `src/lib/whatsapp-templates.ts`

1. **Eliminar `WHATSAPP_TEMPLATE_TOKENS`** — reemplazado por el catálogo posicional
2. **`buildWhatsappTemplatePreview()`** — nueva implementación con regex `{{N}}`
   ```typescript
   messageText.replace(/\{\{(\d+)\}\}/g, (match, numStr) => {
     const field = WHATSAPP_TEMPLATE_FIELDS[parseInt(numStr, 10) - 1];
     if (!field) return match;
     return valueMap.get(field.key) ?? "";
   });
   ```
3. **`buildPreviewValueMap()`** — agregar los 5 campos faltantes al mapa
4. **`validateWhatsappTemplateBaseText()`** — validar que `{{N}}` estén en rango `1..20`
5. **`normalizeWhatsappTemplateFieldOrder()`** — nueva lógica: extrae `number[]` del texto con regex
6. **Templates oficiales por defecto** — actualizar content de `official-default-summary` y `official-default-detailed`, agregar 4 templates nuevos

### `src/components/ScholarshipCalculator.tsx`

Poblar los 5 campos faltantes en el `useMemo` de `whatsappPreviewData`:

| Campo | Fuente |
|-------|--------|
| `scholarshipPercentText` | `formatPercent(resultPanelScholarshipPercent)` |
| `scholarshipAmountText` | `formatMoney(resultPanelScholarshipAmount)` |
| `additionalBenefitPercentText` | `formatPercent(resultPanelBenefitPercent)` |
| `additionalBenefitAmountText` | `formatMoney(resultPanelBenefitAmount)` |
| `firstPaymentText` | `formatMoney(resultPanelFirstPayment)` o `null` |

### `src/components/whatsapp/ResultsWhatsappTemplatePanel.tsx`

1. **Panel de variables (lado derecho)** — lista scrollable con `{{N}} Label` para los 20 campos
2. **Click-to-insert** — al hacer click en un item, inserta `{{N}}` en la posición actual del cursor en el textarea
3. **Preview en vivo** — renderiza el mensaje con valores reales mientras el admin escribe

### `src/app/(admin)/admin/(protected)/whatsapp-templates/page.tsx`

- Verificar que pasa datos de preview de ejemplo al panel editor (puede ser datos ficticios realistas hardcodeados)

---

## Templates oficiales (6)

### 1 — Primer contacto / Resumen `(summary)`
```
¡Hola! 🎓 Ya tengo tu cotización lista.

🏫 {{1}}
📚 {{2}}
👤 {{6}}

💰 Precio lista: {{8}}
🎁 Beca: {{9}}
✅ *Total: {{18}}*

¿Te explico cómo seguir con tu inscripción?
```

### 2 — Primer contacto / Detallado `(detailed)`
```
¡Con esos datos ya tenemos tu estimado listo! 👇

📍 {{1}}
🎓 {{2}}
📘 {{4}} — Plan {{5}}
👤 {{6}}

💲 Precio lista: {{8}}
🏷️ Beca: {{9}}
✅ *Total a pagar: {{18}}*

{{19}}

¿Quieres que revisemos juntos los pasos para continuar?
```

### 3 — Seguimiento / Resumen `(summary)`
```
¡Hola! Solo quería confirmar que recibiste tu cotización 😊

📚 {{2}} — {{4}}
🎁 Beca aplicada: {{9}}
✅ *Total: {{18}}*

¿Tienes alguna duda o quieres avanzar con tu inscripción?
```

### 4 — Seguimiento / Detallado `(detailed)`
```
Hola, ¿cómo estás? Te comparto tu cotización por si tienes dudas 📋

🏫 {{1}}
🎓 {{2}}
📘 {{4}} — Plan {{5}}

💲 Precio lista: {{8}}
🎁 Beca: {{9}}
💡 Beneficio adicional: {{12}}
✅ *Total: {{18}}*

Cualquier pregunta, aquí estoy 🙌
```

### 5 — Cierre / Resumen `(summary)`
```
¡Es un gran momento para inscribirte! 🎉

🎓 {{2}}
✅ *Total: {{18}}*

¿Arrancamos con el proceso hoy?
```

### 6 — Cierre / Detallado `(detailed)`
```
¡Todo listo para tu inscripción! Aquí el resumen final 🎓

📍 {{1}}
🎓 {{2}} — {{4}}
📝 Plan {{5}} | {{6}}

💲 Lista: {{8}}
🏷️ Beca: {{9}}
💡 Ben. adicional: {{12}}
✅ *Total: {{18}}*

{{19}}

¿Empezamos con los documentos hoy?
```

---

## Edge Cases

| Caso | Comportamiento |
|------|---------------|
| `{{99}}` fuera de rango | Se mantiene literal en el mensaje |
| Campo vacío (ej. campus null) | Se reemplaza por `""` |
| Texto sin ningún `{{N}}` | Se renderiza tal cual |
| `{{named_token}}` (sintaxis antigua) | Falla validación al guardar, aviso al admin |
| `sinAccessToScholarship = true` | `{{9}}`, `{{10}}`, `{{11}}` renderizan `"Sin acceso a beca"` |

---

## Lo que NO cambia

- Schema de BD (Prisma) — sin migraciones
- `WhatsappTemplatePreviewData` type — solo se pueblan campos existentes
- API route (`/api/data/whatsapp-templates`) — sin cambios
- Flujo de aprobación de templates (personal → submitted → official)
- El admin puede editar cualquier template oficial desde el panel
