# Blockers

## Critical blockers
- Local Meta env is incomplete:
  - `META_APP_ID`
  - `META_APP_SECRET`
  - `META_INTEGRATION_SECRET`
  - `META_WEBHOOK_VERIFY_TOKEN`
  - `NEXT_PUBLIC_META_APP_ID`
  - `NEXT_PUBLIC_WHATSAPP_EMBEDDED_CONFIG_ID`
- Linked Vercel project is also missing the required Meta WABA env vars.
- No reviewer-safe E2E credentials were present:
  - `E2E_EMAIL`
  - `E2E_PASSWORD`
- No live reviewer connection gate or send/media fixture was present:
  - `E2E_WABA_EXPECT_CONNECTED`
  - `E2E_WABA_ENABLE_SEND`
  - `E2E_WABA_CONTACT_ID`
  - `E2E_WABA_ENABLE_MEDIA`
  - `E2E_WABA_MEDIA_FILE`
- Desktop output path for final videos does not currently exist:
  - expected: `C:\Users\ricar\Desktop\Meta-App-Review-Videos`
  - fallback: `C:\Users\ricar\Scholarship\meta-review-audit\videos`

## Consequence of these blockers
- Embedded Signup cannot launch honestly in this environment.
- WABA assets/templates cannot be synced from a live Meta account.
- Real message/media flows cannot be exercised from Playwright.
- Webhook-driven delivery evidence cannot be proven.
- Final Meta App Review videos cannot be recorded honestly.

## Exact next actions to unblock
1. Add the missing Meta variables to local runtime and to the linked Vercel project.
2. Redeploy the Vercel project after adding those variables.
3. Provide a reviewer-safe sign-in account for `/auth/sign-in`.
4. Connect a real WABA for that reviewer account through Embedded Signup.
5. Configure `META_WEBHOOK_VERIFY_TOKEN` and the Meta webhook subscription.
6. Set the E2E opt-in variables only when a safe test contact and media file exist.
7. Re-run `npx playwright test tests/e2e/waba-app-review.spec.ts`.
8. Record final App Review videos only after the live tests are genuinely passing.
