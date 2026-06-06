# CTA para compartir matricula

La integracion de matricula se conecta con el repo `unidep-id-creator`, desplegado en Vercel como:

```txt
https://unidep-id-creator.vercel.app
```

## CTA publico

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

## Variables en Scholarship

```txt
MATRICULA_SDK_BASE_URL=https://unidep-id-creator.vercel.app
MATRICULA_SDK_SHARE_PATH=/api/matricula/share
MATRICULA_SDK_HEALTH_PATH=/api/health
MATRICULA_SDK_API_KEY=<mismo valor que UNIDEP_ID_CREATOR_API_KEY>
MATRICULA_SDK_API_KEY_HEADER=x-api-key
```

## Variables en unidep-id-creator

```txt
UNIDEP_ID_CREATOR_PUBLIC_URL=https://unidep-id-creator.vercel.app
UNIDEP_ID_CREATOR_API_KEY=<secret compartido con Scholarship>
```

## Flujo

```txt
CTA Scholarship
  -> /matricula/share
  -> POST /api/integrations/matricula/share
  -> SDK @relead/matricula-sdk
  -> https://unidep-id-creator.vercel.app/api/matricula/share
  -> credentialUrl
  -> Abrir credencial UNIDEP
```
