# ReCalc UI refactor closeout

## Estado

La reunificación visual global queda cerrada como fase técnica inicial.

El sistema final apunta a una interfaz:

- blanca como base principal (`#FFFFFF` en superficies);
- fondo blanco con tinte azul muy sutil;
- bordes azul claro;
- acentos azul claro/ReCalc;
- contraste legible sin oscurecer la app;
- navegación consistente entre público, auth, workspace y admin;
- responsive seguro para móvil, desktop y ventanas dinámicas.

## Entry point de tema

Todas las capas globales de UI se importan desde:

```txt
apps/web/src/app/interface-theme.css
```

`layout.tsx` debe seguir importando solo ese entrypoint para el sistema visual global, además de las capas históricas aún necesarias.

## Orden actual de capas

El orden de importación es intencional:

1. `interface-unification.css`  
   Tokens base, contraste general, tablas, formularios y normalización global.

2. `interface-structure-phase-2.css`  
   Ajustes estructurales iniciales por pantalla.

3. `interface-light-blue-white.css`  
   Corrección de dirección visual hacia blanco + azul claro.

4. `interface-component-pass-light.css`  
   Ajuste fino de componentes y superficies claras.

5. `interface-unidep-pass.css`  
   Polish específico de workspace `/unidep`.

6. `interface-auth-pass.css`  
   Polish específico de `/auth/*`.

7. `interface-public-pass.css`  
   Polish específico de landing pública `/`.

8. `interface-admin-pass.css`  
   Polish específico de `/admin`.

9. `interface-shell-pass.css`  
   Headers, drawers, sidebars y navegación compartida.

10. `interface-a11y-responsive-pass.css`  
   Accesibilidad, foco, responsive, reduced motion, overflow y texto largo.

## Rutas validadas visualmente por alcance

Revisar visualmente en cada deploy:

```txt
/
/auth/sign-in
/auth/sign-up
/auth/forgot-password
/auth/reset-password
/auth/denied
/unidep
/unidep/oferta
/unidep/costos
/unidep/planes
/unidep/directorio
/unidep/planteles
/unidep/formatos
/unidep/web
/unidep/waba
/profile
/admin
/admin/capacitacion
/admin/reporting
/admin/importaciones
/admin/auditoria
```

## Checklist de regresión UI

### Global

- La app se ve predominantemente blanca, no gris ni oscura.
- El fondo mantiene solo un tinte azul muy sutil.
- Los textos principales tienen contraste suficiente.
- Los textos secundarios no quedan demasiado claros.
- Los botones disabled siguen siendo legibles.
- Los placeholders son visibles.
- No aparece scroll horizontal accidental en mobile.

### Shell / navegación

- Drawer de `/unidep` abre y cierra correctamente.
- Drawer de `/admin` abre y cierra correctamente.
- El botón `X` del drawer no compite con la tarjeta de identidad.
- La navegación activa tiene contraste claro.
- El hover no oscurece ni rompe el tema blanco/azul.
- El drawer tiene scroll interno usable.

### Workspace `/unidep`

- Header conserva acciones propias de la app autenticada.
- CTAs se sienten integrados y no como bloques sueltos.
- Cotizador y panel de resultado se mantienen en superficies blancas.
- Inputs/selects son legibles.
- Tablas/listados no se desbordan horizontalmente sin scroll.
- Elementos con `bg-slate-*`, `text-white` o estilos oscuros heredados no rompen el tema claro.

### Admin

- Admin conserva jerarquía operativa.
- No se ve más oscuro que el resto de la app.
- Tablas admin tienen scroll horizontal y alto controlado.
- Formularios, selects y compositores mantienen contraste.
- CTAs y pills se sienten ligeros y consistentes.

### Auth y público

- Auth se ve como acceso premium, no como admin.
- Landing mantiene intención comercial.
- Header público queda blanco y ligero.
- Formularios auth son legibles en mobile.

### Accesibilidad / responsive

- Navegación por teclado muestra foco visible.
- `prefers-reduced-motion` reduce animaciones/transiciones.
- Modales, drawers y popovers permanecen dentro del viewport.
- Inputs en mobile tienen tamaño legible y evitan zoom accidental.
- Textos largos no rompen layout.

## Decisiones técnicas

- La mayoría del refactor visual se cerró como CSS focalizado para minimizar riesgo en TypeScript, auth y lógica del cotizador.
- No se modificó Prisma, DB, API, middleware, server actions ni reglas de permisos.
- El diseño final queda deliberadamente claro/blanco. Evitar nuevas capas que regresen a grises oscuros o fondos pesados.
- Cualquier nueva capa visual debe importarse desde `interface-theme.css` y documentarse en el orden de capas.

## Próximo mantenimiento recomendado

Después de estabilizar visualmente en producción, conviene una fase futura de limpieza técnica más profunda:

1. Reducir gradualmente selectores globales con `:has(...)` migrando componentes clave a clases semánticas.
2. Consolidar tokens en un archivo base más pequeño.
3. Reemplazar overrides de utilidades oscuras por clases propias en componentes.
4. Crear pruebas visuales o snapshots para `/`, `/auth/sign-in`, `/unidep`, `/profile` y `/admin`.
5. Eliminar shims/deuda histórica cuando ya no haya imports antiguos.
