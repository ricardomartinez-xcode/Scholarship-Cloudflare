# Auditoría inicial del repositorio y línea base de remediación

## Alcance aplicado en esta rama

Esta rama establece una línea base segura y auditada para continuar el plan de transformación del producto sin tocar todavía la lógica funcional de negocio.

### Cambios aplicados

1. **Limpieza de residuos locales del repositorio**
   - Eliminación de archivos y configuraciones ligadas al entorno del editor o agente.
   - Endurecimiento de `.gitignore` para evitar que vuelvan a entrar al repositorio.

2. **Saneamiento inmediato de secretos expuestos**
   - Se retiraron credenciales y endpoints hardcodeados de scripts operativos e históricos.
   - Los scripts ahora requieren variables de entorno explícitas y fallan de forma segura si faltan.

3. **Trazabilidad técnica para las siguientes fases**
   - Se documentó un diagnóstico estructural para permisos, roles, invitaciones, panel admin, scripts y deuda técnica.

## Hallazgos críticos detectados

### Exposición de secretos en scripts
Se detectaron múltiples scripts con connection strings, hosts y passwords embebidos directamente en el código. Esto representa riesgo real de acceso no autorizado, uso accidental de entornos productivos y rotación difícil de credenciales.

### Herencia excesiva del rol `ADMIN`
El sistema actual sigue una lógica legacy donde `Role.ADMIN` resuelve todas las capacidades por defecto. Esto debilita el valor del catálogo de permisos y genera enforcement parcial.

### Mezcla de permisos globales y membresías por organización
Actualmente conviven rol global (`USER` / `ADMIN`), overrides de capacidades administrativas y membresías organizacionales (`owner` / `admin` / `member`). La separación conceptual existe, pero no está consolidada como modelo de autorización consistente.

## Recomendación de secuencia

1. rotar inmediatamente cualquier credencial que haya estado expuesta en el historial del repo;
2. sustituir la herencia total de `ADMIN` por capacidades explícitas o por una capa transicional controlada;
3. construir matriz `capacidad -> ruta -> vista -> CTA -> mutación -> validación backend`;
4. reagrupar el panel administrativo por dominios;
5. consolidar scripts de migración y seed en un flujo oficial;
6. rediseñar invitaciones y compatibilidad UI de forma incremental.

## Riesgos de compatibilidad

1. varias pantallas administrativas dependen indirectamente del comportamiento legacy de `Role.ADMIN`;
2. cambiar permisos sin una matriz de enforcement puede ocultar UI sin bloquear backend o viceversa;
3. algunos scripts parecen históricos pero siguen siendo útiles como referencia operativa y conviene marcarlos antes de eliminarlos.
