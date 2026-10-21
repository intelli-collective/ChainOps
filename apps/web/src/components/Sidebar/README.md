# Shared sidebar

Preview at `/sidebar-preview/contracts`. The preview renders only the sidebar;
menu links change its selected state without opening unfinished feature routes.

Use inside the existing React Router (do not add another BrowserRouter):

```tsx
import { Sidebar } from './components/Sidebar'

<div style={{ display: 'flex' }}>
  <Sidebar projectId="chainvault" />
  <main style={{ flex: 1, minWidth: 0 }}>{/* Route content */}</main>
</div>
```

The parent layout controls positioning and mobile drawer behavior. The sidebar is
284px wide, fills the viewport height, and scrolls independently on short screens.
It does not apply global styles or change the application's layout.

`NavLink` automatically selects matching routes, including nested contract/event
pages, and adds `aria-current="page"`. Tab and Enter operate all links. Icons are
decorative inline SVGs and require no packages.

Default groups mirror Build, Release, and Operate in the reference. Projects links
to `/projects`; all other items link to `/projects/:projectId/<feature>`.
Pass `groups` to supply the application's actual routes (for example the current
standalone `/deployments` route). This component does not register those routes.

Optional props: `workspaceName`, `workspaceDescription`, `brandHref`, `logoSrc`,
`brandingSrc`, `className`, `sectionStyle`, and `onNavigate` (for closing a parent mobile drawer).
Section labels use unboxed text with a slim accent via `sectionStyle="accent"` by default. Pass
`sectionStyle="line"` to use the earlier uppercase labels with divider lines.
The `groups` prop accepts named groups of `{ label, to, icon, end? }` items. Icon
names and props are exported as TypeScript types from this folder.

The brand uses the original public/logo.jpg and public/branding.jpg. CSS crops the
branding image's existing symbol to avoid duplicating the separate logo. Asset
colors are preserved; black image backgrounds blend with the sidebar. Defaults
respect Vite's configured base URL. Both asset paths can be overridden.

Colors follow the Final UI Color Specification: solid #0A1010 sidebar,
#034139 selected rows, #075047 selected hover, #111A18 ordinary hover,
#EDF3F1 active text, #A4B3AF default labels, and #57C7BD small accents.
There are no decorative gradients, glows, or shadows. Scoped sidebar variables
use the shared `--co-*` semantic tokens when available, with specification values
as fallbacks. Layout, compact spacing, navigation, and brand assets are preserved.
