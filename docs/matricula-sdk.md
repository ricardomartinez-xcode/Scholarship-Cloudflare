# Matricula SDK

SDK interno para compartir matricula desde Scholarship hacia un servicio externo sin acoplar la app al contrato HTTP final.

## Uso directo

```ts
import { createMatriculaSdkClient } from "@relead/matricula-sdk";

const client = createMatriculaSdkClient({
  baseUrl: "https://matricula.example.com",
  auth: { type: "bearer", token: process.env.MATRICULA_SDK_BEARER_TOKEN! },
});

await client.shareMatricula({
  matricula: "A01234567",
  source: "scholarship",
  student: {
    fullName: "Nombre Alumno",
    email: "alumno@example.com",
  },
  academic: {
    campus: "Tijuana",
    program: "Licenciatura",
    modality: "presencial",
  },
});
```

## Variables de entorno sugeridas en Scholarship

```txt
MATRICULA_SDK_BASE_URL=https://matricula.example.com
MATRICULA_SDK_BEARER_TOKEN=...
# o:
MATRICULA_SDK_API_KEY=...
MATRICULA_SDK_API_KEY_HEADER=x-api-key

MATRICULA_SDK_SHARE_PATH=/api/matricula/share
MATRICULA_SDK_STATUS_PATH=/api/matricula/share/{shareId}
MATRICULA_SDK_HEALTH_PATH=/api/health
MATRICULA_SDK_TIMEOUT_MS=10000
```

## Contrato esperado

El endpoint de compartir recibe JSON por `POST` y puede responder cualquier JSON. El SDK normaliza campos comunes:

```json
{
  "ok": true,
  "shareId": "share_123",
  "externalId": "ext_123",
  "status": "accepted",
  "message": "Matricula recibida"
}
```

Si el endpoint usa otros nombres, el payload completo queda disponible en `response.raw`.
