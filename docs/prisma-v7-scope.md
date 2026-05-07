# Prisma 7: alcance de migración

Esta fase no actualiza Prisma. Solo deja documentado el trabajo real para una ronda técnica separada.

## Objetivo

Migrar el proyecto desde `prisma-client-js` hacia `prisma-client` en Prisma ORM v7 sin mezclarlo con cambios de producto, UI o auth.

## Cambios esperados

1. Cambiar el generator de Prisma:

```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}
```

2. Definir `output` explícito.
3. Evaluar si conviene introducir `prisma.config.ts`.
4. Revisar el wrapper de Prisma actual para que importe desde la nueva salida generada.
5. Validar compatibilidad con Next.js App Router y el formato de módulos del proyecto.

## Superficie que debe revisarse

1. `prisma/schema.prisma`
   - cambio de provider
   - ruta de salida

2. `src/lib/prisma.ts`
   - actualizar imports del cliente generado
   - validar singleton en desarrollo

3. scripts o utilidades que importen `@prisma/client`
   - revisar imports directos
   - decidir si siguen usando el paquete o la salida generada

4. configuración de build y tipado
   - `tsconfig.json`
   - posibles rutas o alias
   - generación en CI/CD

## Riesgos reales

1. Romper imports en runtime si el código sigue esperando `@prisma/client`.
2. Generar cliente en una ruta no incluida en build.
3. Cambios ESM/CJS no contemplados en scripts auxiliares.
4. Desalinear `prisma generate` con Vercel o flujos de deploy.

## Validación mínima para esa futura fase

1. `npx prisma generate`
2. `npx tsc --noEmit`
3. `npm run build`
4. smoke test de rutas que usen Prisma
5. revisión de scripts admin / seeds / syncs

## Recomendación

Hacer esta migración en una rama separada y sin mezclar cambios de producto. El alcance es técnico y transversal; no conviene arrastrarlo dentro de una ronda de UI, auth o integraciones.
