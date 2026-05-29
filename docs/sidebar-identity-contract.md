# Sidebar identity contract

## Regla vigente

La identidad visible del usuario en la app autenticada debe seguir esta regla:

```txt
Header: sin nickname
Sidebar / drawer: Usuario / nickname
```

## Por qué

Durante la refactorización visual se decidió eliminar duplicidades entre header y sidebar.

El header de la app autenticada debe mostrar acciones de sesión y navegación contextual, pero no repetir el nombre del usuario. La identidad del usuario vive en la sidebar/drawer para mantener una navegación más limpia y consistente con el admin panel.

## Implementación actual

La tarjeta de identidad del drawer se renderiza estructuralmente desde:

```txt
apps/web/src/components/app/AppChrome.tsx
```

La navegación se renderiza desde:

```txt
apps/web/src/components/app/AppSidebar.tsx
```

`AppSidebar` no debe renderizar visualmente la tarjeta de identidad; su responsabilidad es pintar grupos de navegación y footer nav. La tarjeta superior del drawer pertenece al shell de `AppChrome`.

## Contrato visual

En el drawer de `/unidep` debe aparecer:

```txt
Usuario
<nickname o email fallback>
```

El valor visible debe resolverse con esta prioridad:

1. `userDisplayName` si existe y no está vacío.
2. `userEmail` como fallback.
3. `Usuario` como último fallback.

## Qué no hacer

- No volver a mostrar el nickname en el header de la app autenticada.
- No eliminar la identidad del drawer/sidebar.
- No volver a usar sincronización por DOM, `MutationObserver` o atributos como `data-workspace-identity="synced"`.
- No duplicar `Usuario / nickname` en hero, header y sidebar al mismo tiempo.

## Rutas de validación

Revisar después de cambios en shell/sidebar:

```txt
/unidep
/profile
/admin
```

Checklist mínimo:

- `/unidep`: abrir drawer y confirmar `Usuario / nickname`.
- `/unidep`: confirmar que el header no muestra nickname.
- `/profile`: cambiar nickname y volver a `/unidep` para confirmar que la sidebar refleja el valor actualizado después de sesión/render.
- `/admin`: confirmar que no se afectó la identidad propia del admin drawer.
