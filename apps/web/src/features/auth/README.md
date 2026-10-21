# M5-FE-01: Login and registration

Routes: `/login` and `/register`. Other paths currently redirect to login; the application shell and module routes remain Task 2.

The two exported screenshots supplied in chat are the visual reference. No Figma URLs or original artwork assets were provided. The Ethereum artwork is an SVG approximation; the development disclosure and feedback states extend the screenshots. Mobile uses the same palette with a stacked layout because no mobile frames were supplied. Legal content and password reset are unavailable and explain this in a dialog.

`AuthPage` accepts an `AuthService` for later API integration. The default mock service simulates latency and success/failure without storing passwords, creating accounts, issuing tokens, or persisting sessions. Registration succeeds for valid input except the reserved demo email, which simulates an existing account. Login accepts only `demo@chainops.dev` / `ChainOps1!`.

## Verification

From the repository root, run `npm run build:web` and `npm run lint -w apps/web`. Start with `npm run dev:web`.

Verified during implementation: production build and ESLint passed. Headless Chrome checks passed for login validation/focus, pending state, invalid and valid demo login, password visibility, registration navigation/reset, required registration fields/consent, password policy, registration success, duplicate-email error, and absence of horizontal overflow at 375px and 768px. Desktop login and mobile registration were visually inspected. SVG artwork remains an approximation of the supplied reference.

- Open both routes directly, follow both navigation links, and check browser Back/Forward.
- Submit empty forms; the first invalid field should receive focus and each invalid field should have an associated error.
- Check malformed email and registration passwords shorter than 8 characters or missing a number/symbol; check required consent.
- Toggle password visibility with mouse and keyboard.
- Submit incorrect login credentials, then the demo credentials; verify error/success messages and disabled controls while pending.
- Register with the reserved demo email to see the duplicate-account error, then another valid email to see simulated success.
- Open the reset/legal dialogs, close with Escape or Close, and check keyboard focus remains inside while open.
- Compare desktop against the provided screenshots; check 375px and 768px widths for wrapping and overflow.

No real authentication or protected routes are implemented. GitHub issue association and screenshot review are still required before a PR. Follow `CONTRIBUTING.md` for issue-based branch names and Conventional Commit titles; target `dev`.
