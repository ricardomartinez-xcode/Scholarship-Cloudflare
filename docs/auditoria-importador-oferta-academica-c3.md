# Auditoria importador oferta academica C3

## Diferencial encontrado

El CSV C3 visible usa una plantilla plana con columnas:

```csv
ciclo,plantel,programa,linea,modalidad,plan,modulo,No. de modulos,horario,horario escolarizado,horario ejecutivo,activo,notas
```

Las filas C3 pueden repetir la misma oferta por ciclo + plantel + programa + modulo para expresar modalidades distintas, por ejemplo una fila presencial y otra ejecutivo. En el modelo Prisma actual esas dos variantes viven en la misma fila de `ProgramOffering`, usando `escolarizado`, `ejecutivo`, `escolarizadoSchedule` y `ejecutivoSchedule`.

El aplicador de sesiones `academic-offer-replace.ts` estaba construyendo las ofertas de reemplazo con una llave natural correcta, pero cuando encontraba dos filas con la misma llave usaba comportamiento equivalente a last-write-wins. Eso permitia que una modalidad pisara a la otra y explicaba que el estado final no coincidiera con el payload/CSV esperado.

## Correccion aplicada

- Se fusionan filas repetidas por `cycle + campusId + programId + module` antes de `createMany`.
- Se unen planes de precio sin duplicados.
- Se preservan horarios escolarizado/ejecutivo.
- Se conserva `lineOfBusiness`, `level`, `moduleCount` y `subjectsByModule` cuando vienen en cualquiera de las filas.
- Se agrega plantilla CSV C3 documentada en `docs/plantilla-oferta-academica-c3.csv`.

## Nota de schema

No se cambia Prisma para este caso porque la representacion actual sugiere una sola oferta por ciclo + campus + programa + track, con flags de modalidad. Cambiar la restriccion unica para incluir modalidad duplicaria ofertas y romperia consultas que esperan una oferta combinada.
