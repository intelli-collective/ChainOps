# Authentication screens

The existing Figma-based login/register layout and artwork now use the Nest API by default. `mockAuthService.ts` remains an explicit development fixture; production routes do not use it. Provider buttons begin server-managed Google/GitHub flows. Legal documents and password reset are still pending separate work.

`api.ts` keeps CSRF state only in memory and sends credentials via HttpOnly cookies. `Session.tsx` restores sessions with refresh rotation, guards application routes, periodically rechecks sessions, and handles email verification. Returning organization members go to `/projects`; users without memberships go to the existing onboarding placeholder at `/onboarding`. Registration first requires verified email ownership. No organizations are created by these flows.

Vite proxies `/auth` to the local API on port 3000. Production hosting needs the same origin proxy arrangement. See [authentication setup](../../../../../docs/AUTHENTICATION.md) and the safe environment template there. No Vite environment variables contain secrets.

Run `npm run test:auth -w apps/web`, `npm run lint -w apps/web`, and `npm run build:web` from the repository root. Tests cover redirects, registration verification notices, provider links, errors, and refresh-based session restoration. Unrelated modules and their mock services are preserved.
