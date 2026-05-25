# Inventario de archivos grandes - Fase 3

Alcance: seguimiento Fase 3 de `docs/audits/2026-05-24-monorepo-intranet-audit.md`.

Comando fuente:

```bash
npm run repo:large-files -- --limit=20 --min-lines=1000
```

## Snapshot local

| Lineas | Archivo | Dominio | Siguiente corte recomendado |
| ---: | --- | --- | --- |
| 5673 | `apps/web/src/app/globals.css` | UI global | Separar tokens/utilidades admin/publicas antes de mover reglas por superficie. |
| 2378 | `apps/web/src/components/ScholarshipCalculator.tsx` | Cotizador publico | Extraer normalizadores/calculos puros y componentes de secciones visuales. |
| 1983 | `apps/web/src/lib/meta-whatsapp.ts` | WhatsApp/Meta | Separar payload builders, validadores y clientes HTTP testeables. |
| 1859 | `apps/web/src/lib/google-integration.ts` | Google | Separar auth/client, transformadores y acciones de sincronizacion. |
| 1834 | `apps/web/src/components/unidep/WebCampaignsPanel.tsx` | UNIDEP workspace | Extraer formularios, tabla y acciones de campaña por componentes. |
| 1781 | `apps/web/src/components/unidep/ContactsPanel.tsx` | UNIDEP workspace | Separar filtros, tabla y detalle/contact actions. |
| 1670 | `apps/web/src/components/admin/BenefitsClient.tsx` | Admin beneficios | Continuar extrayendo paneles ya segmentados: beneficios, becas base e importadores. |
| 1499 | `apps/chrome-extension/recalc-sidepanel/campaigns.js` | Extension | Separar builders/runner/config luego de cerrar `preview-first` como unica variante. |
| 1463 | `apps/web/src/components/unidep/WabaEmbeddedSignupSection.tsx` | WhatsApp/Meta | Extraer estados de flujo y formularios por paso. |
| 1457 | `apps/web/src/components/unidep/AgendaPanel.tsx` | UNIDEP workspace | Extraer calendario/listado/formulario. |
| 1447 | `apps/web/src/lib/extension-automation.ts` | Extension/API | Separar parsing, validacion y cliente de automatizacion. |
| 1389 | `apps/web/src/app/(admin)/admin/(protected)/unidep/fees/FeesClient.tsx` | Admin costos | Extraer tabs `fees`, `availability`, `materias`, `seed`. |
| 1362 | `apps/web/src/lib/admin-config-snapshots.ts` | Admin config | Separar snapshot serializers por modulo. |
| 1343 | `apps/web/src/lib/whatsapp-templates.ts` | WhatsApp | Separar catalogos, render y validacion. |
| 1269 | `apps/chrome-extension/recalc-sidepanel/panel.css` | Extension | Separar estilos por panel despues de estabilizar sync. |
| 1231 | `apps/web/src/components/unidep/UnidepWorkspace.tsx` | UNIDEP workspace | Extraer shell, shortcuts y orquestacion de paneles. |
| 1210 | `apps/web/src/components/capacitacion/RolplayWorkspace.tsx` | Capacitacion | Separar chat, evaluacion y paneles laterales. |
| 1176 | `apps/web/src/lib/importers/academic-offer.ts` | Importadores | Separar parseo, normalizacion y validacion por nivel. |
| 1152 | `apps/chrome-extension/recalc-sidepanel/panel.js` | Extension | Separar estado, API client y eventos UI. |
| 1089 | `apps/web/src/components/admin/UsersClient.tsx` | Admin usuarios | Extraer tabla, permisos y formularios. |

## Orden sugerido

1. Extension: continuar despues de PR #202 porque ya redujo variantes y agrego sync/verify.
2. Admin beneficios/costos: ya tienen tabs; son candidatos a extracciones por panel con bajo cambio de comportamiento.
3. Librerias puras: `admin-config-snapshots`, `whatsapp-templates`, `academic-offer` permiten tests unitarios enfocados.
4. Superficies grandes de workspace/cotizador: requieren browser QA por alto impacto visual.
