# Migracion de Storage a Supabase Storage

## Estado

- Rama: `migration/vercel-supabase`
- Runtime objetivo: Next.js en Vercel, Node.js Runtime
- Storage objetivo: Supabase Storage
- Estado remoto: no ejecutado. No se copiaron objetos remotos ni se modificaron buckets remotos.
- Entorno permitido: Supabase staging.

## Flujo anterior

La aplicacion tenia dos patrones principales:

| Area | Flujo anterior | Riesgo |
| --- | --- | --- |
| Archivos admin | Presigned URL S3-compatible hacia R2 y metadata en `file_asset` | Dependencia de credenciales R2 y URL externa |
| Content bucket | Listado/lectura de bucket R2 publico o manifest | Dependencia de bucket publico R2 |
| Campanas extension | R2 en Cloudflare runtime, Cloudinary fuera de Cloudflare | Bifurcacion de proveedores y runtime |
| Preview/share/download | Signed URL R2 o proxy content bucket | No portable a Vercel sin R2 |

## Flujo nuevo

| Area | Implementacion nueva | Archivo principal |
| --- | --- | --- |
| Abstraccion Storage | `upload`, `download`, `signed URL`, `list`, validacion MIME/tamano | `apps/web/src/lib/storage/supabase-storage.ts` |
| Content bucket | Listado y proxy sobre bucket `documents` | `apps/web/src/lib/storage/content-bucket.ts` |
| Upload admin | `PUT /api/files/:id/upload` escribe desde servidor a Supabase Storage | `apps/web/src/app/api/files/[id]/upload/route.ts` |
| Upload legacy | `PUT /api/files/upload-object` conserva compatibilidad de presign antiguo | `apps/web/src/app/api/files/upload-object/route.ts` |
| Downloads | signed URLs Supabase Storage | `apps/web/src/lib/file-asset-redirect.ts` |
| Campanas | bucket `attachments`, path `extension-campaigns/{userId}/{uuid}.{ext}` | `apps/web/src/app/api/ext/campaigns/upload/route.ts` |

Los archivos historicos R2 quedaron aislados bajo `legacy/cloudflare/apps-web/src/lib`.

## Buckets

| Bucket | Publico | Uso | MIME esperado | Tamano |
| --- | --- | --- | --- | --- |
| `documents` | No | PDFs, imagenes, videos y documentos administrados | PDF, PNG, JPEG, WEBP, MP4, WEBM, DOC/DOCX, XLSX, PPTX | `MAX_UPLOAD_BYTES`, default 20 MB |
| `attachments` | No | Media de campanas y adjuntos efimeros de usuario | PNG, JPEG, WEBP para campanas | `MAX_UPLOAD_BYTES`, default 20 MB |
| `avatars` | No | Reservado para perfiles | Imagenes | Pendiente |
| `imports` | No | Reservado para archivos de importacion | CSV/XLSX/JSON segun modulo | Pendiente |
| `exports` | No | Reservado para exports generados | CSV/XLSX/PDF/ZIP segun modulo | Pendiente |

No se crean buckets desde codigo de aplicacion. La migracion SQL prepara definiciones base en `storage.buckets`; en staging deben validarse limites MIME/tamano desde la configuracion de Supabase.

## Convencion de paths

Archivos administrados:

```text
organizations/{organizationId}/users/{userId}/{prefix}/{resourceId}/{yyyy-mm-dd}/{uuid}.{ext}
```

La ruta actual usa `organizationId=shared` cuando el flujo no conoce tenant. Esto evita colisiones, pero no se usa como autorizacion unica.

Campanas:

```text
extension-campaigns/{userId}/{uuid}.{ext}
```

La ruta de lectura valida que el asset empiece con `extension-campaigns/{authUserId}/` antes de descargar. Para datos multi-organizacion nuevos debe agregarse `organizationId` al path y a la validacion de dominio.

## Politicas RLS

La migracion SQL base define politicas sobre `storage.objects` para buckets privados:

- usuarios autenticados pueden leer objetos propios o de organizaciones donde son miembros;
- administradores de organizacion pueden modificar objetos de su organizacion;
- el flujo normal de usuario no usa service role;
- las rutas server-side usan service role solo para operaciones administrativas controladas y nunca lo exponen al cliente.

Pendiente de validacion remota:

- confirmar que los bucket IDs existen en Supabase staging;
- confirmar que las politicas `storage.objects` no son recursivas;
- probar acceso cruzado entre organizaciones;
- ajustar paths heredados que no contienen `organizations/{organizationId}`.

## Migracion de objetos

Script:

```bash
npm run migration:migrate-storage
npx tsx scripts/migrate-r2-to-supabase-storage.ts \
  --manifest=artifacts/r2-storage-export/manifest.json \
  --out=artifacts/storage-migration-report.json \
  --dry-run
```

Aplicacion en staging:

```bash
NEXT_PUBLIC_SUPABASE_URL=<staging-url> SUPABASE_SERVICE_ROLE_KEY=<staging-service-role> \
  npx tsx scripts/migrate-r2-to-supabase-storage.ts \
  --manifest=artifacts/r2-storage-export/manifest.json \
  --out=artifacts/storage-migration-report.json \
  --bucket=documents \
  --apply \
  --verify-download
```

El manifest puede ser un arreglo o `{ "objects": [...] }`:

```json
{
  "objects": [
    {
      "key": "program-assets/2026-01-01/example.pdf",
      "targetKey": "organizations/shared/users/system/documents/migrated/2026-01-01/example.pdf",
      "sourcePath": "artifacts/r2-storage-export/program-assets/example.pdf",
      "contentType": "application/pdf",
      "sizeBytes": 12345,
      "sha256": "..."
    }
  ]
}
```

El script:

- opera en dry-run por defecto;
- no llama APIs de Cloudflare directamente;
- sube desde `sourcePath` o `sourceUrl`;
- valida tamano y SHA-256 cuando el manifest los provee;
- detecta destinos duplicados dentro del manifest;
- reintenta uploads;
- puede descargar despues de subir y comparar hash/tamano;
- escribe un reporte JSON exportable.

## Validaciones

Locales ejecutadas:

| Validacion | Resultado |
| --- | --- |
| `npm run typecheck` | Paso |
| `npm run lint` | Paso |
| Pruebas enfocadas Storage/archivos/rutas publicas | Paso: 6 archivos, 23 tests |

Pendientes por falta de credenciales staging:

- subir un objeto real al bucket `documents`;
- descargar mediante `/api/files/:id/auth-view`;
- crear signed URL en preview/share;
- subir media de campana al bucket `attachments`;
- verificar RLS de Storage entre dos usuarios/organizaciones;
- ejecutar migracion real R2 a Supabase Storage.

## Rollback

La produccion Cloudflare no fue modificada. Para rollback de la rama:

1. Mantener los buckets R2 existentes sin cambios.
2. Descartar o no promover la rama `migration/vercel-supabase`.
3. Usar los helpers historicos en `legacy/cloudflare/apps-web/src/lib` solo como referencia para restaurar imports si se necesitara una rama de emergencia.
4. No borrar objetos Supabase Storage cargados durante staging hasta comparar conteos y hashes.
