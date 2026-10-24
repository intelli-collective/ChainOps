# Authentication screens

The auth screens use the Nest API and a shared ChainOps split layout, the supplied orbit/logo artwork and the approved jade/teal color values. Decorative glow follows the user's auth-specific concept; unrelated product screens retain their existing styles. `mockAuthService.ts` remains an explicit fixture and is not used by application routes. Google and GitHub buttons are disabled with “Coming soon”; the existing backend provider code is retained for future configuration. Legal documents remain pending.

`api.ts` keeps CSRF state only in memory and sends credentials via HttpOnly cookies. `Session.tsx` restores sessions with refresh rotation, guards application routes, rechecks on browser restoration/visibility, responds to logout across tabs and handles email verification. Returning organization members go to `/projects`; users without memberships go to `/onboarding`. Registration first requires verified email ownership. No organizations are created by these flows.

`/forgot-password` and `/reset-password` use `RecoveryPage.tsx` with the same layout and controls. Email links carry single-use tokens in fragments, removed from browser history after reading. Passwords require at least 8 characters (128 maximum), consistent with the API. New-password fields use `autocomplete=new-password`; login uses `autocomplete=off`, fresh state on route entry and clearing on `pageshow`. The application stores no credentials in persistent browser storage. Password managers may still offer independently saved credentials despite autocomplete hints; remove saved entries in browser settings if desired.

Vite proxies `/auth` to the local API on port 3000. Production hosting needs the same origin proxy arrangement. See [authentication setup](../../../../../docs/AUTHENTICATION.md) and the safe environment template there. No Vite environment variables contain secrets.

Run `npm run test:auth -w apps/web`, `npm run lint -w apps/web`, and `npm run build:web` from the repository root. Tests cover redirects, registration verification notices, provider links, errors, and refresh-based session restoration. Unrelated modules and their mock services are preserved.
