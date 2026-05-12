# AGENTS.md

## Propósito del archivo

Este archivo define reglas obligatorias para cualquier agente, desarrollador o asistente automatizado que modifique esta extensión.

La prioridad del proyecto es mantener intacta la base funcional estable de la extensión y permitir cambios únicamente en las áreas de interfaz, diseño, layout, cotizador y visualización de resultados, siempre que dichos cambios no alteren los flujos protegidos descritos abajo.

---

## Reglas críticas: archivos y flujos que NO se deben modificar

Queda estrictamente prohibido modificar, refactorizar, optimizar, renombrar, reordenar, formatear o sustituir cualquier parte del código relacionada con los siguientes flujos:

1. Inyector de scripts hacia WhatsApp Web.
2. Comunicación Extensión → WhatsApp Web.
3. Comunicación WhatsApp Web → Extensión.
4. Comunicación Extensión → Backend.
5. Comunicación Backend → Extensión.
6. Subida, recuperación, transformación, almacenamiento temporal y envío de imágenes/binarios.
7. Adjuntado de imágenes, archivos o multimedia al compositor de WhatsApp Web.
8. Selectores, botones, nodos, atributos, composer, inputs o acciones del DOM de WhatsApp Web.
9. Orden exacto en el que se usan los selectores, botones y acciones de WhatsApp Web.
10. Clasificación funcional de envíos correctos, incorrectos, fallidos, omitidos o recuperables.
11. Runner, heartbeat, autenticación, tokens, sesión, reportes de campaña y reportes por envío.

Estas reglas aplican aunque parezca que existe una forma "más limpia", "más moderna", "más rápida" o "más segura" de implementar el flujo. No se deben aplicar mejoras por criterio propio sobre estas áreas.

---

## Archivos protegidos

Salvo instrucción explícita y directa del propietario del proyecto, no modificar los siguientes archivos ni sus responsabilidades funcionales:

```text
background.js
content-whatsapp.js
content/bridge.js
injected/wa-main.js
lib/whatsapp/*
lib/storage/attachments.js
lib/campaigns/buildMessage.js
```

También se consideran protegidos todos los bloques de código, funciones, constantes, selectores, nombres de mensajes, eventos, prioridades, delays, payloads, headers, claves de storage, identificadores de archivos, nombres MIME, estructuras de reporte y decisiones condicionales que formen parte del flujo:

```text
Extensión → Backend → Extensión → WhatsApp Web
WhatsApp Web → Extensión → Backend
```

No se debe cambiar el comportamiento de estos flujos moviendo lógica a otros archivos.

---

## WhatsApp Web: reglas inmutables

No modificar:

- Scripts que se inyectan en WhatsApp Web.
- Método de inyección.
- Orden de inyección.
- Prioridad de ejecución.
- Selectores utilizados para localizar el chat, el composer, el botón Adjuntar, inputs de archivo, previews, botones de envío o estados de mensaje.
- Orden en el que se presionan o consultan los botones del DOM de WhatsApp.
- Tiempos, esperas, verificaciones, reintentos o decisiones usados en el flujo de adjuntar y enviar.
- Forma de cargar imágenes/binarios al mensaje.
- Conversión de binarios, `Blob`, `File`, `DataTransfer`, `ArrayBuffer`, Base64 o MIME types.
- Criterios para determinar si un envío fue exitoso o fallido.
- Cualquier fallback interno usado para WhatsApp Web.

No sustituir selectores por otros aunque funcionen localmente. WhatsApp Web cambia con frecuencia y el proyecto depende de conservar el flujo base validado.

---

## Backend, auth, runner y heartbeat

No modificar:

- Endpoints usados por la extensión.
- Método de autenticación.
- Headers.
- Payloads.
- Estructura de respuestas esperadas.
- Tokens, sesión o recuperación de credenciales.
- Runner de campañas.
- Heartbeat.
- Sincronización de estado con backend.
- Comunicación de resultados por envío.
- Comunicación de resultados por campaña.
- Subida o recuperación de imágenes/binarios desde backend.
- Asociación entre archivos multimedia, campañas, contactos y mensajes.
- Botones que ya estén conectados correctamente a estos flujos.

Si un botón no está conectado, se puede conectar solo si se reutiliza exactamente el flujo existente y sin alterar las piezas protegidas.

---

## Diseño, tema y estilos globales

El tema visual de la extensión debe estar globalizado.

Toda modificación de diseño debe aplicarse de forma consistente a:

- Paneles.
- Secciones.
- Encabezados.
- Formularios.
- Selectores.
- Inputs.
- Botones.
- Estados activos, hover, disabled, loading y error.
- Cards.
- Tablas.
- Informes contraíbles.
- Panel de campañas.
- Panel de resultados.
- Cotizador.
- Modales, banners, alerts o mensajes de estado.

No se permiten estilos aislados que rompan la identidad visual general.

Los colores, tipografía, bordes, radios, sombras, espaciados, tamaños de botón y jerarquías visuales deben depender de tokens o variables globales cuando existan. Si se agrega una nueva sección, esta debe heredar el mismo sistema visual y no definir una paleta paralela.

No cambiar los colores ni el diseño base obtenido de V4.7.0 salvo instrucción explícita del propietario del proyecto.

---

## Cotizador

El cotizador debe permanecer siempre conectado y actualizado con:

- Costos.
- Beneficios.
- Becas.
- Costos académicos.
- Líneas de negocio.
- Reglas de cálculo.
- Combinaciones válidas de carrera, programa, modalidad, campus, periodo o equivalente.

La fuente principal de datos debe ser:

```text
https://recalc.relead.com.mx
```

El cotizador debe consultar o sincronizar contra la app de Recalc cuando el flujo lo requiera.

Si no es posible conectar con `recalc.relead.com.mx`, el cotizador debe activar un flujo de respaldo para no dejar de funcionar. Este respaldo debe cumplir lo siguiente:

1. Cubrir todas las líneas de negocio disponibles.
2. Cubrir todas las combinaciones válidas esperadas por la extensión.
3. Evitar resultados vacíos, `NaN`, `undefined`, errores silenciosos o pantallas rotas.
4. Mostrar un resultado utilizable aunque la conexión falle.
5. Mantener consistencia con la última estructura válida conocida.
6. Indicar internamente el origen del dato cuando aplique: remoto, caché, respaldo o fallback.
7. No bloquear el cálculo de becas por fallas temporales de red.
8. No romper la interfaz del panel de resultados.

Cualquier corrección de cálculo debe aplicarse de forma uniforme a cada línea de negocio cuando corresponda, no solo a maestría, salvo que la regla académica indique explícitamente una excepción.

---

## Panel de resultados del cotizador

El panel de resultados del cotizador debe conservar el mismo formato, composición y diseño visual que la app de Recalc.

Esto incluye:

- Orden visual de la información.
- Jerarquía de títulos, subtítulos, importes, beneficios y totales.
- Agrupación de costos académicos.
- Presentación de becas.
- Espaciado.
- Tipografía.
- Estados visuales.
- Estilo de cards o contenedores.
- Botones de acción.
- Mensajes de error o respaldo.
- Comportamiento responsive.

No crear un diseño alternativo para resultados si se desvía del formato visual usado por la app.

---

## Campañas

Las configuraciones de campañas deben mantenerse coherentes con la interfaz global y con el flujo funcional base.

No alterar los mecanismos protegidos de envío. Solo se pueden ajustar controles visuales o configuraciones externas cuando no cambien la forma en que el runner, WhatsApp Web o backend procesan los envíos.

Los elementos como delay por reclamo, variación segura y sincronización de fecha/hora deben conservar su intención funcional y no interferir con el orden de envío, adjuntos, reportes ni heartbeat.

---

## Informes y resultados de campañas

Los informes contraíbles deben usar el sistema visual global de la extensión.

No deben romper:

- Estados por contacto.
- Estados por campaña.
- Totales.
- Errores.
- Reintentos.
- Omisiones.
- Reporte a backend.
- Clasificación de correcto/incorrecto.
- Historial mostrado al usuario.

La UI puede mejorar la lectura, pero no cambiar la semántica de los datos reportados.

---

## Botones y acciones

Antes de agregar, quitar o reparar un botón, verificar:

1. Si el botón está conectado a un flujo protegido.
2. Si dispara un evento relacionado con WhatsApp Web.
3. Si modifica datos enviados al backend.
4. Si altera campañas, runner, heartbeat o auth.
5. Si duplica una acción existente.
6. Si su diseño respeta el tema global.

Los botones redundantes pueden eliminarse solo si no son necesarios para un flujo protegido y si su eliminación no cambia el comportamiento funcional esperado.

---

## Criterio de modificación permitido

Se permiten cambios en:

- Interfaz visual.
- Layout.
- Responsive.
- Estilos globales.
- Panel de resultados.
- Informes contraíbles.
- Presentación del cotizador.
- Correcciones del cálculo del cotizador.
- Conexión/fallback del cotizador con Recalc.
- Reparación visual o conexión de botones no protegidos.

Siempre que no se modifique directa ni indirectamente ningún flujo protegido.

---

## Checklist obligatorio antes de entregar cambios

Antes de entregar un ZIP o commit, verificar:

- [ ] No se modificaron archivos protegidos.
- [ ] No se cambió el inyector de scripts hacia WhatsApp Web.
- [ ] No se cambiaron selectores del DOM de WhatsApp.
- [ ] No se cambió el orden de Adjuntar → cargar binario → preview → enviar.
- [ ] No se cambió la subida, recuperación o envío de imágenes/binarios.
- [ ] No se alteró el flujo Extensión-Backend-Extensión-WhatsApp.
- [ ] No se alteró auth, runner ni heartbeat.
- [ ] El diseño está globalizado.
- [ ] Los colores y estilos respetan el diseño base definido.
- [ ] El cotizador conecta con `recalc.relead.com.mx`.
- [ ] El cotizador tiene fallback funcional.
- [ ] El fallback cubre todas las líneas de negocio.
- [ ] Ninguna combinación válida rompe el cálculo.
- [ ] El panel de resultados coincide visualmente con la app.
- [ ] Los informes contraíbles conservan datos y semántica.
- [ ] Los botones agregados o reparados no interfieren con flujos protegidos.
- [ ] El ZIP final contiene este `AGENTS.md`.

---

## Regla final

Cuando exista duda entre conservar funcionalidad base o aplicar una mejora, siempre se debe conservar la funcionalidad base.

No hacer cambios preventivos, cosméticos, estructurales o de optimización sobre los flujos protegidos.

La extensión debe seguir funcionando como la base validada y solo debe adoptar mejoras visuales, de cotizador y de resultados dentro de los límites definidos en este archivo.
