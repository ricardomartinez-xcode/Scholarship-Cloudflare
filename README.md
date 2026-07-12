ReCalc Next.js (recuperación híbrida desde la extensión web).

## 🤖 Automated Code Review

This repository includes an automated code review system that runs on every push to `main`. It identifies medium-high to high severity issues and provides AI-ready repair instructions.

📖 **[Read the full documentation](docs/AUTOMATED_CODE_REVIEW.md)**

## 📍 Roadmap post-merge

El plan operativo vigente (bloques, prioridad y validaciones) está documentado en `docs/POST_MERGE_ROADMAP.md`.

### Quick Overview
- ✅ Runs automatically on push to main
- 🔍 Checks ESLint errors and TypeScript type issues
- 📊 Generates detailed reports with fix instructions
- 💬 Comments on commits when issues are found
- 🚫 Non-intrusive (review only, no auto-fix)

### Run Locally
Before pushing, you can run the same checks locally:
```bash
./scripts/local-code-review.sh
```

## Getting Started

Desde la raiz del monorepo:

```bash
npm ci --foreground-scripts
npm run dev
```

La aplicacion Next.js vive en `apps/web` y queda disponible en
`http://localhost:3000`.

## Calidad y release

Antes de considerar una release, corre:

```bash
npm run release:gate
```

La promoción de ramas con `npm run promote` sólo aplica para releases aprobadas y limitadas a bug fixes, no para cualquier push a `development`. La guía operativa y de secretos vive en [docs/QUALITY_RELEASE_GATES.md](docs/QUALITY_RELEASE_GATES.md).

## Supabase + Vercel migration

La rama `migration/vercel-supabase` prepara la ruta objetivo:

- Next.js estandar con `next build`.
- Vercel Preview desde la raiz del monorepo.
- Supabase PostgreSQL como base de datos.
- Supabase Auth para sesion SSR/middleware.
- Supabase Realtime con Postgres Changes.
- Supabase Storage para archivos administrados y media de campanas.

Variables base:

```bash
NEXT_PUBLIC_APP_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
DATABASE_URL=
DIRECT_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

Documentacion de la migracion:

- [Auditoria](docs/migration-audit.md)
- [Linea base](docs/migration-baseline.md)
- [Base de datos](docs/database-migration.md)
- [Auth](docs/auth-migration.md)
- [Realtime](docs/realtime-migration.md)
- [Storage](docs/storage-migration.md)
- [Vercel](docs/vercel-deployment.md)
- [Validacion](docs/migration-validation.md)
- [Rollback](docs/migration-rollback.md)
- [Reporte final](docs/migration-final-report.md)

La produccion Cloudflare permanece intacta. No ejecutes migraciones destructivas ni cambies DNS/dominio productivo desde esta rama.

### Importacion administrativa de oferta

El flujo operativo es deliberadamente de dos pasos:

1. En `/admin/oferta?panel=imports`, subir XLSX/CSV y crear una sesion de preview.
2. En `/admin/importaciones/<sessionId>`, revisar warnings/diff, confirmar
   `PUBLICAR` y elegir actualizacion por lote o reemplazo del alcance importado.

El reemplazo solo afecta el ciclo y los planteles presentes en el archivo. Al
publicar o revertir se revalidan oferta, planes, formatos y planteles usados por
el cotizador.

### API (datos)
La app consume datos **solo** desde:
- `/api/data/pricing-options`
- `/api/data/quote`
- `/api/data/benefits`

Estas rutas requieren autenticacion y autorizacion server-side.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
