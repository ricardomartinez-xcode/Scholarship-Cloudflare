# CTA para compartir matricula

La integracion de matricula puede exponerse en la UI publica como un CTA normal usando la ruta interna:

```txt
/matricula/share
```

## Configuracion del CTA

En el panel de CTAs crea uno con:

```txt
Texto visible: Compartir matricula
Tipo de CTA: Link o ruta
URL: /matricula/share
Estilo visual: primary
Ubicacion: la superficie donde quieras mostrarlo
Estado: Activo
```

La pagina `/matricula/share` muestra un formulario y envia el payload a:

```txt
POST /api/integrations/matricula/share
```

Ese endpoint usa `shareMatriculaFromScholarship()` en backend, por lo que los tokens del SDK nunca se exponen al navegador.

## Variables requeridas

```txt
MATRICULA_SDK_BASE_URL=https://servicio-de-matricula.example.com
MATRICULA_SDK_BEARER_TOKEN=...
```

O con API key:

```txt
MATRICULA_SDK_BASE_URL=https://servicio-de-matricula.example.com
MATRICULA_SDK_API_KEY=...
MATRICULA_SDK_API_KEY_HEADER=x-api-key
```

## Siguiente iteracion

Cuando se quiera conectar el CTA directamente al resultado del calculador, conviene pasar el contexto de cotizacion a `ConfiguredCtaList` o crear una variante especifica que llame al mismo endpoint sin pedir captura manual.
