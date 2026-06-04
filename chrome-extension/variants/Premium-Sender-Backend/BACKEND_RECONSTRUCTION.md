# ReCalc Sender backend compatibility

This folder contains the recovered Chrome extension bundle adapted to ReCalc.

The ReCalc-backed version returns a `totalaccess` entitlement and uses clean route aliases on `https://recalc.relead.com.mx`.

The extension expects these backend routes:

| Route | Method | Payload | Response expected by extension |
| --- | --- | --- | --- |
| `/mv3/get-license` | POST | `FormData.encData` AES-256-CBC JSON | `{ data: <encrypted JSON> }` with `totalaccess` entitlement |
| `/mv3/logout` | POST | FormData fields | JSON |
| `/mv3/templates` | POST | JSON `{ templates, authid }` | HTTP 2xx is enough |
| `/mv3/getresponse` | POST | `FormData.encData` AES-256-CBC JSON | `{ data: <encrypted JSON> }` |
| `/mv3/general-data-1` | POST | `FormData.encData` AES-256-CBC JSON | JSON |
| `/mv3/dom-selectors` | GET | none | `{ data: <encrypted JSON> }` |
| `/uninstall` | GET | optional `encData` query | redirect/HTML |

The compatibility implementation lives in the Next.js app under:

- `apps/web/src/lib/premium-sender-legacy.ts`
- `apps/web/src/app/mv3/**/route.ts`
- `apps/web/src/app/uninstall/route.ts`

## Crypto contract recovered from the ZIP

The old extension uses AES-CBC with:

```txt
key = abc123abc123abc123abc123abc123ab
iv  = a1b2c3d4e5f6g7h8
mode = CBC
padding = PKCS#7
encoding = base64
```

## License-free strategy

`buildLegacyLicense()` keeps its name because the extension bundle still uses license terminology. Internally it now behaves as an entitlement adapter:

- always returns `status: "success"`;
- sets `license_required: false`;
- returns `entitlement: "totalaccess"`;
- keeps legacy fields like `license_key`, `remainingdays`, `allowed_devices`, and `all_devices` so the old extension UI does not break;
- exposes feature flags for all Premium Sender benefits.

This makes the current extension usable while monetization is moved to a future model outside the old license flow.

## Runtime notes

The implementation is intentionally permissive and compatibility-first. It lets the repointed extension connect to `https://recalc.relead.com.mx`.

Recommended next steps:

1. Persist `/mv3/templates` templates by browser profile, ReCalc user, or future account identity.
2. Connect `/mv3/getresponse` to the real AI/rewrite service if the feature should remain active.
3. Replace default DOM selectors when WhatsApp Web changes.
4. Keep these routes until all installed extension builds use the ReCalc aliases.
5. When the future monetization model is ready, gate access outside the old license key path and keep this adapter as a compatibility shim.
