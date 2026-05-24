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

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open http://localhost:3000 with your browser to see the result.

You can start editing the page by modifying `src/app/page.tsx`. The page auto-updates as you edit the file.

## Calidad y release

Antes de considerar una release, corre:

```bash
npm run release:gate
```

La promoción de ramas con `npm run promote` sólo aplica para releases aprobadas y limitadas a bug fixes, no para cualquier push a `development`. La guía operativa y de secretos vive en [docs/QUALITY_RELEASE_GATES.md](docs/QUALITY_RELEASE_GATES.md).

## Neon (Auth + DB)
- Auth usa **Neon Auth (Better Auth)** con `NEON_AUTH_BASE_URL`, `NEXT_PUBLIC_NEON_AUTH_BASE_URL` y `NEON_AUTH_COOKIE_SECRET`.
- DB usa `DATABASE_URL` (Neon serverless).
- Esquema SQL: `sql/000_init.sql`
- Seed inicial: `npm run seed:neon`

**Restricción de dominio**
El acceso se limita a `@unidep.edu.mx` y `@*.unidep.edu.mx` en server-side.

### Vercel (recomendado)
1. Conecta el proyecto con **Neon** desde el panel de Vercel (Integrations).
2. Verifica que se haya creado la variable `DATABASE_URL` en el entorno.
3. Agrega manualmente las llaves de Neon Auth:
   - `NEON_AUTH_BASE_URL`
   - `NEXT_PUBLIC_NEON_AUTH_BASE_URL` (mismo valor que `NEON_AUTH_BASE_URL`)
   - `NEON_AUTH_COOKIE_SECRET` (>= 32 caracteres)
   - Opcional: ALLOWED_EMAILS (CSV de correos extra permitidos)
   - Opcional: ALLOWED_EMAIL_DOMAINS (CSV de dominios permitidos, ejemplo: @relead.com.mx,@partner.edu)
4. Asegura que las variables estén activas en **Production** y **Preview**.

### API (datos)
La app consume datos **solo** desde:
- `/api/data/pricing-options`
- `/api/data/quote`
- `/api/data/benefits`

Estas rutas requieren autenticación (Neon Auth) y dominio permitido.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
