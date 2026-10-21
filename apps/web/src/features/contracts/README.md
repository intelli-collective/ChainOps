# M2-FE-02: Contract Registry

Target route: `/projects/:projectId/contracts`. The supplied screenshot is the
visual reference. An exact Figma frame URL has not been provided.

`ContractRegistryPage` is exported from `index.ts`. It accepts the project ID and
an optional `ContractRegistryService`, so the mocked data can be replaced with an
API service later. It contains no shared app shell or router. The temporary local
preview resolves `/projects/chainvault/contracts` through `App.tsx`.

The page supports search by name, address, and version; network, contract, and
status filters; copying a full address; a details dialog with transaction hash,
release, and deployment time; and registering an existing contract into an
in-memory preview. Registration validates the EVM address and transaction hash,
prevents duplicate network/address pairs, and clears on reload. It does not
query a blockchain or claim that a contract was deployed or registered on chain.

The service provides loading, empty, and error states. Filtering can produce a
distinct no-results state. The table scrolls horizontally on narrow screens.

Run `npm run dev:web` from the repository root, then open
`http://localhost:5173/projects/chainvault/contracts` (or the port printed by
Vite). Run `npm run build -w apps/web` and `npm run lint -w apps/web` for checks.

The service regression check runs without another package:

```bash
./node_modules/.bin/vite build apps/web --ssr src/features/contracts/registry.check.ts --outDir node_modules/.cache/registry-check
node apps/web/node_modules/.cache/registry-check/registry.check.js
```
