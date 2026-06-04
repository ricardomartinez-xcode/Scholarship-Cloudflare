# Premium Sender legacy backend compatibility

This folder contains the recovered Chrome extension bundle from the old `premiumsender.app` integration.

The extension expects these legacy backend routes:

| Legacy route | Method | Payload | Response expected by extension |
| --- | --- | --- | --- |
| `/mv3/get-license.php` | POST | `FormData.encData` AES-256-CBC JSON | `{ data: <encrypted JSON> }` |
| `/mv3/logout.php` | POST | FormData fields | JSON |
| `/mv3/templates.php` | POST | JSON `{ templates, authid }` | HTTP 2xx is enough |
| `/mv3/getresponse.php` | POST | `FormData.encData` AES-256-CBC JSON | `{ data: <encrypted JSON> }` |
| `/mv3/general-data-1.php` | POST | `FormData.encData` AES-256-CBC JSON | JSON |
| `/mv3/dom-selectors.php` | GET | none | `{ data: <encrypted JSON> }` |
| `/uninstall.php` | GET | optional `encData` query | redirect/HTML |

The compatibility implementation lives in the Next.js app under:

- `apps/web/src/lib/premium-sender-legacy.ts`
- `apps/web/src/app/mv3/**/route.ts`
- `apps/web/src/app/uninstall.php/route.ts`

## Crypto contract recovered from the ZIP

The old extension uses AES-CBC with:

```txt
key = abc123abc123abc123abc123abc123ab
iv  = a1b2c3d4e5f6g7h8
mode = CBC
padding = PKCS#7
encoding = base64
```

## Runtime notes

The initial implementation is intentionally permissive and compatibility-first. It lets the repointed extension connect to `https://recalc.relead.com.mx` without requiring the old `premiumsender.app` PHP backend.

Recommended next steps:

1. Replace the fallback license response in `buildLegacyLicense()` with real ReCalc auth/license validation.
2. Persist `/mv3/templates.php` templates by user/session.
3. Connect `/mv3/getresponse.php` to your real AI/rewrite service if needed.
4. Replace default DOM selectors when WhatsApp Web changes.
5. Keep these routes until all installed extension builds are migrated away from legacy `/mv3/*.php` endpoints.
