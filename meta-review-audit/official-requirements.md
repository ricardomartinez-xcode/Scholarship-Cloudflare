# Official Requirements Audit

## Reviewed source inventory
- https://developers.facebook.com/devpolicy/
- https://developers.facebook.com/docs/app-review/submission-guide/screen-recordings/
- https://developers.facebook.com/docs/resp-plat-initiatives/individual-processes/app-review/submission-guide/
- https://developers.facebook.com/documentation/business-messaging/whatsapp/solution-providers/app-review/
- https://developers.facebook.com/documentation/business-messaging/whatsapp/solution-providers/get-started-for-tech-providers
- https://developers.facebook.com/documentation/business-messaging/whatsapp/permissions/
- https://developers.facebook.com/documentation/business-messaging/whatsapp/get-started
- https://developers.facebook.com/documentation/business-messaging/whatsapp/access-tokens/
- https://developers.facebook.com/documentation/business-messaging/whatsapp/business-phone-numbers/registration/
- https://developers.facebook.com/documentation/business-messaging/whatsapp/business-phone-numbers/media/
- https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview
- https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/overview/
- https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users/
- https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/hosted-es/
- https://developers.facebook.com/documentation/business-messaging/whatsapp/solution-providers/manage-accounts/
- https://developers.facebook.com/documentation/business-messaging/whatsapp/business-scoped-user-ids
- https://developers.facebook.com/docs/features-reference/business-asset-user-profile-access/
- https://developers.facebook.com/docs/permissions/
- https://developers.facebook.com/documentation/facebook-login/facebook-login-for-business
- https://vercel.com/docs/environment-variables
- https://vercel.com/docs/environment-variables/manage-across-environments
- https://vercel.com/docs/environment-variables/sensitive-environment-variables
- https://vercel.com/docs/cli
- https://vercel.com/docs/cli/env
- https://vercel.com/docs/projects/deploy-from-cli
- https://playwright.dev/docs/videos
- https://playwright.dev/docs/api/class-video
- https://playwright.dev/docs/api/class-browser
- https://playwright.dev/docs/codegen
- https://playwright.dev/docs/test-use-options
- https://developers.openai.com/codex/mcp/
- https://developers.openai.com/learn/docs-mcp/
- https://developers.openai.com/codex/learn/best-practices/
- https://developer.1password.com/docs/cli/get-started/
- https://developer.1password.com/docs/cli/secrets-environment-variables/
- https://developer.1password.com/docs/cli/app-integration/

## Meta App Review video requirements
- Meta App Review expects the submission to show the exact in-product flow that needs the permission, starting from a clear entry point and ending in a visible result. The reviewer should not have to guess what happened. https://developers.facebook.com/docs/app-review/submission-guide/screen-recordings/ https://developers.facebook.com/docs/resp-plat-initiatives/individual-processes/app-review/submission-guide/
- The recording must match the real app behavior and policy-compliant usage. Hidden setup steps, mock success states, or unsupported claims create review risk. https://developers.facebook.com/devpolicy/ https://developers.facebook.com/documentation/business-messaging/whatsapp/solution-providers/app-review/
- For WhatsApp solution providers, Meta expects a reviewer-friendly walkthrough of onboarding, asset access, template usage, messaging behavior, and any other claimed permission-dependent action. https://developers.facebook.com/documentation/business-messaging/whatsapp/solution-providers/get-started-for-tech-providers https://developers.facebook.com/documentation/business-messaging/whatsapp/solution-providers/app-review/

## Permission and feature meaning
- `whatsapp_business_messaging` is justified by real WhatsApp Business messaging operations such as sending messages, handling delivery/inbound states, and working with approved WhatsApp business messaging assets. It is not justified by local-only template drafts or cosmetic UI. https://developers.facebook.com/documentation/business-messaging/whatsapp/permissions/ https://developers.facebook.com/documentation/business-messaging/whatsapp/get-started https://developers.facebook.com/documentation/business-messaging/whatsapp/business-phone-numbers/media/
- `whatsapp_business_management` is justified by real WABA management behavior such as embedded signup, business account onboarding, phone number context, template management, and business profile or asset reads that belong to the WhatsApp Business Platform. https://developers.facebook.com/documentation/business-messaging/whatsapp/permissions/ https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/overview/ https://developers.facebook.com/documentation/business-messaging/whatsapp/business-phone-numbers/registration/ https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview
- `business_management` is broader Business Manager asset access. The docs do not support requesting it just because the app works with WhatsApp. It should only be requested when the product really reads or manages Business Manager assets beyond the WhatsApp-specific flows already covered elsewhere. https://developers.facebook.com/docs/permissions/ https://developers.facebook.com/documentation/facebook-login/facebook-login-for-business
- Business Asset User Profile Access is limited to business-user profile fields such as `id`, `ids_for_business`, `name`, and `picture`. The docs do not support using it as a generic excuse to collect profile data that the product does not truly use. https://developers.facebook.com/docs/features-reference/business-asset-user-profile-access/
- Business-scoped user IDs (BSUID) are business-scoped identifiers intended to keep a stable identity for a user within a business context. They matter when phone number alone is not enough for durable identity, linkage, or deduplication. https://developers.facebook.com/documentation/business-messaging/whatsapp/business-scoped-user-ids

## Legitimate Recalc behaviors supported by the docs
- Recalc can legitimately justify `whatsapp_business_messaging` if the WABA tab lets a reviewer connect a WABA, choose a real contact, send a real text/template/media message, and see a persisted result or webhook-driven delivery event. https://developers.facebook.com/documentation/business-messaging/whatsapp/get-started https://developers.facebook.com/documentation/business-messaging/whatsapp/business-phone-numbers/media/
- Recalc can legitimately justify `whatsapp_business_management` if the reviewer can see embedded signup, WABA metadata, phone number metadata, official Meta templates, business profile data, and other real WhatsApp asset context inside the app. https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users/ https://developers.facebook.com/documentation/business-messaging/whatsapp/solution-providers/manage-accounts/ https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview
- Recalc cannot currently justify `business_management` because no real Business Manager read/write flow exists in-product after the repo audit.
- Recalc can only justify Business Asset User Profile Access if it actually stores or displays `id`, `ids_for_business`, `name`, or `picture` from a business user profile and those fields are part of a reviewer-visible flow.
- Recalc should treat BSUID as a correctness feature first: deduplication, stable identity, and resilient contact/conversation linkage. A standalone BSUID review video only makes sense if live data is available and visible.

## Vercel CLI requirements relevant to this audit
- `vercel env ls` is the safest command for a name-level audit of remote variables because it does not print secret values. https://vercel.com/docs/cli/env
- `vercel env pull` writes development variables to a local file. The docs support it operationally, but in this audit it was intentionally not used because writing plaintext secrets to disk would violate the secret-handling rule for this task. https://vercel.com/docs/cli/env https://vercel.com/docs/environment-variables/sensitive-environment-variables
- `vercel env run` is useful to test runtime availability of env vars without redeploying, but it still needs careful Windows quoting to avoid leaking or corrupting output. https://vercel.com/docs/cli/env
- If new environment variables are added to Vercel, the project normally needs a redeploy before the app picks them up. https://vercel.com/docs/environment-variables/manage-across-environments https://vercel.com/docs/projects/deploy-from-cli

## Playwright and recording requirements relevant to this audit
- Playwright video recording depends on context-level recording and on properly closing the page/context so the video is flushed to disk. https://playwright.dev/docs/videos https://playwright.dev/docs/api/class-video https://playwright.dev/docs/api/class-browser
- Stable reviewer runs benefit from fixed viewport, locale, timezone, trace collection, and deterministic selectors. https://playwright.dev/docs/test-use-options
- Codegen is useful for discovery, but the final tests still need robust, reviewer-meaningful locators rather than brittle generated selectors. https://playwright.dev/docs/codegen

## 1Password and MCP relevance
- 1Password CLI supports secure command execution patterns such as `op run` so the repo can consume secrets without hardcoding them in files. https://developer.1password.com/docs/cli/get-started/ https://developer.1password.com/docs/cli/secrets-environment-variables/ https://developer.1password.com/docs/cli/app-integration/
- OpenAI Codex MCP guidance was relevant only for tooling discipline and connector-safe orchestration. It does not justify any Meta permission by itself. https://developers.openai.com/codex/mcp/ https://developers.openai.com/learn/docs-mcp/ https://developers.openai.com/codex/learn/best-practices/
