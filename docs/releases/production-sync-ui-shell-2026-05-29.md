# Production sync: UI shell and sidebar identity

## Objetivo

Agrupar en un PR de release los cambios ya integrados a `main` después del último deployment production visible en Vercel.

Este PR no reimplementa esos cambios porque ya están en `main`; sirve como commit nuevo y trazable para producción, además de documentar exactamente qué debe llegar a Vercel cuando se dispare el próximo production deployment.

## Estado observado

Último production deployment visible en Vercel:

```txt
21c80fad31c9624ec5d24b4617a3157bc62a5e9f
refactor(ui): eliminar shim obsoleto de identidad workspace (#277)
```

`main` actual antes de este release sync:

```txt
6e1a645477c5ee1ae7debcdb629639c2fe1a6404
docs(app): documentar contrato de nickname en sidebar (#279)
```

## Cambios incluidos desde el último production visible

### #278 — AppSidebar props typing

- Ordena el contrato de props de `AppSidebar`.
- Extrae el tipo inline a `AppSidebarProps`.
- Mantiene explícito que el nickname debe permanecer visible en la sidebar/drawer.
- No modifica UI activa.

### #279 — Sidebar identity contract

- Documenta la regla oficial:

```txt
Header: sin nickname
Sidebar / drawer: Usuario / nickname
```

- Aclara que `AppChrome` renderiza la identidad visual del drawer.
- Aclara que `AppSidebar` se mantiene enfocado en navegación.
- Prohíbe volver a usar sincronización DOM o `MutationObserver` para identidad.

## Validación esperada en producción

Después del deployment production:

- `/unidep`: el header no muestra nickname.
- `/unidep`: al abrir el drawer/sidebar aparece `Usuario / nickname`.
- `/profile`: cambiar nickname sigue funcionando.
- `/admin`: drawer/admin no se afecta.
- No hay cambios visuales inesperados respecto al estado actual de `main`.

## Nota de Vercel

Se observó límite diario de deployments API:

```txt
api-deployments-free-per-day
remaining: 0
```

Si Vercel no dispara production inmediatamente al mergear este PR, hacer redeploy manual cuando el límite se reinicie.
