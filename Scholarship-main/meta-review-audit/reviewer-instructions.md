# Reviewer Instructions

## Current status
- The WABA reviewer workspace exists in-product, but this environment is not yet reviewer-ready because the Meta configuration and reviewer credentials are incomplete.

## App URL(s)
- Local development URL: `http://localhost:3000/unidep?tab=waba`
- Linked Vercel project: `scholarship` (`prj_chv85vrZXdrGrw3hxRg7e8fdmLgL`)
- Reviewer-ready hosted URL: not provided in this audit because the linked Vercel project is missing the required Meta env vars.

## Login instructions
- Sign in through `/auth/sign-in`.
- A reviewer-safe user account with access to `/unidep` is required.
- No reviewer credentials were stored in this repo or in local env during this audit.

## Click path to the WABA tab
1. Sign in.
2. Open `/unidep`.
3. Click the `WABA` tab.

## Reproduction steps by permission / feature

### `whatsapp_business_management`
1. Open the `WABA` tab.
2. Click `Launch Embedded Signup` if no WABA connection exists.
3. After connection, click `Sync from Meta`.
4. Review the `Connection status`, `Business assets`, and `Official Meta templates` panels.

### `whatsapp_business_messaging`
1. Open the `WABA` tab.
2. Select a contact from `Reviewer contacts`.
3. Use `Send action` to send text, template, or media.
4. Confirm the result in `Recent messages`.
5. Confirm status changes in `Webhook and delivery evidence`.

### Business Asset User Profile Access
1. Open the `WABA` tab.
2. Select a contact.
3. Review the `Identity and BSUID` panel for real profile fields, source, and sync time.
4. Only use this flow if the environment actually returns those fields.

### BSUID identity flow
1. Open the `WABA` tab.
2. Select a contact that already has live Meta identity data.
3. Review `Business-scoped user ID`, `Parent BSUID`, `Username`, and sync timestamps.
4. Correlate the same contact with a message or webhook event.

## Video mapping
- `01-whatsapp_business_messaging`: not recorded; blocked.
- `02-whatsapp_business_management`: not recorded; blocked.
- `03-business_management`: intentionally not applicable.
- `04-business_asset_user_profile_access`: not recorded; blocked.
- `05-bsuid-identity-flow`: not recorded; blocked.

## Manual reviewer caveats
- The WABA tab now explains blockers in-product, but the environment still lacks the required Meta configuration.
- Do not rely on Playwright technical artifacts as final App Review videos; they are not reviewer-quality recordings.
