# Vercel Environment Audit

## Command summary
- Linked project detected from `.vercel/project.json`:
  - projectId: `prj_chv85vrZXdrGrw3hxRg7e8fdmLgL`
  - orgId: `team_DG8gbTWkHHkL4Bf28mvdkfk1`
  - projectName: `scholarship`
- Executed successfully:
  - `vercel env ls`
- Intentionally not executed:
  - `vercel env pull .env.local.audit`
  - reason: it would write plaintext secrets to disk, which violates the secret-handling rule for this audit.
- Partially attempted:
  - `vercel env run ...`
  - result: the CLI reached the linked project and began loading `development` environment data, but a Windows quoting issue blocked the safe inline boolean probe. The audit therefore relies on `vercel env ls`, local env name inspection, and direct code references.

## Variable matrix

| variable_name | required_or_optional | where_used_in_code | integration_dependency | found_in_code | found_in_local_env | found_in_vercel | environment_scope_if_known | action_needed |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `META_APP_ID` | Required | `src/lib/meta-whatsapp.ts` | Meta OAuth code exchange | Yes | No | No | Not present in `vercel env ls` | Add to Development, Preview, and Production; redeploy afterward. |
| `META_APP_SECRET` | Required | `src/lib/meta-whatsapp.ts` | Meta OAuth code exchange | Yes | No | No | Not present in `vercel env ls` | Add to Development, Preview, and Production; redeploy afterward. |
| `META_INTEGRATION_SECRET` | Required | `src/lib/meta-whatsapp.ts` | Local encryption for stored Meta tokens | Yes | No | No | Not present in `vercel env ls` | Add to Development, Preview, and Production; redeploy afterward. |
| `META_WEBHOOK_VERIFY_TOKEN` | Required for webhook evidence | `src/lib/meta-whatsapp.ts`, `src/app/api/integrations/meta/webhook/route.ts` | Meta webhook verification handshake | Yes | No | No | Not present in `vercel env ls` | Add to the environments that will receive webhook traffic, then configure the Meta webhook subscription. |
| `META_GRAPH_API_VERSION` | Optional with fallback | `src/lib/meta-whatsapp.ts` | Explicit Graph version pinning | Yes | No | No | Not present in `vercel env ls` | Optional. If omitted, code falls back to `v25.0`. Pin it if you want deterministic rollout control. |
| `NEXT_PUBLIC_META_APP_ID` | Required | `src/components/unidep/WabaEmbeddedSignupSection.tsx`, `src/lib/meta-whatsapp.ts` | Meta JS SDK initialization in the WABA tab | Yes | No | No | Not present in `vercel env ls` | Add to Development, Preview, and Production; redeploy afterward. |
| `NEXT_PUBLIC_WHATSAPP_EMBEDDED_CONFIG_ID` | Required | `src/components/unidep/WabaEmbeddedSignupSection.tsx`, `src/lib/meta-whatsapp.ts` | Embedded Signup launch | Yes | No | No | Not present in `vercel env ls` | Add to Development, Preview, and Production; redeploy afterward. |
| `NEXT_PUBLIC_WHATSAPP_ES_SESSION_INFO_VERSION` | Optional with fallback | `src/components/unidep/WabaEmbeddedSignupSection.tsx`, `src/lib/meta-whatsapp.ts` | Embedded Signup session info version | Yes | No | No | Not present in `vercel env ls` | Optional. Default is `3`. Add only if you need to override. |
| `E2E_EMAIL` | Test-only required | `tests/e2e/helpers.ts` | Playwright login for `/auth/sign-in` | Yes | No | Not audited | Local-only | Provide reviewer-safe local test credentials via secure env loading, ideally with `op run`. |
| `E2E_PASSWORD` | Test-only required | `tests/e2e/helpers.ts` | Playwright login for `/auth/sign-in` | Yes | No | Not audited | Local-only | Provide reviewer-safe local test credentials via secure env loading, ideally with `op run`. |
| `E2E_WABA_EXPECT_CONNECTED` | Test-only opt-in | `tests/e2e/waba-app-review.spec.ts` | Enables live connected-state assertions | Yes | No | Not audited | Local-only | Set to `1` only when the test account already has a live WABA connection. |
| `E2E_WABA_ENABLE_SEND` | Test-only opt-in | `tests/e2e/waba-app-review.spec.ts` | Allows real outbound WhatsApp sends in Playwright | Yes | No | Not audited | Local-only | Set to `1` only with explicit approval and a reviewer-safe recipient. |
| `E2E_WABA_CONTACT_ID` | Test-only required for live send/media | `tests/e2e/waba-app-review.spec.ts` | Selects the target contact row in the WABA tab | Yes | No | Not audited | Local-only | Provide a reviewer-safe contact id after seeding or selecting the target user. |
| `E2E_WABA_ENABLE_MEDIA` | Test-only opt-in | `tests/e2e/waba-app-review.spec.ts` | Enables live media upload/send test | Yes | No | Not audited | Local-only | Set to `1` only when media send is approved and a safe file exists. |
| `E2E_WABA_MEDIA_FILE` | Test-only required for media flow | `tests/e2e/waba-app-review.spec.ts` | Absolute path for reviewer-safe media file | Yes | No | Not audited | Local-only | Provide a safe absolute file path outside the repo or in a controlled fixture folder. |

## Local environment findings
- `.env.local` exists, but the audited variable names present there were:
  - `ADMIN_EMAIL`
  - `DATABASE_URL`
  - `DIRECT_URL`
  - `GOOGLE_CLIENT_ID`
  - `GOOGLE_CLIENT_SECRET`
  - `NEON_AUTH_BASE_URL`
  - `NEON_AUTH_COOKIE_SECRET`
  - `NEON_JWKS_URL`
  - `SMTP_FROM_NAME`
  - `SMTP_REPLY_TO`
  - `VERCEL_OIDC_TOKEN`
- None of the required Meta WABA variables were present in `.env.local`.

## Redeploy requirement
- Yes. Once the missing Meta vars are added to Vercel, the linked project needs a redeploy before the WABA tab can consume them.
