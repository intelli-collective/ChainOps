# ChainOps landing page

The public home route `/` follows the supplied landing-page screenshot. It uses
the existing React Router and preserves `/login`, `/register`, `/deployments`,
and the contract registry preview.

## Assets

- `/ChainOps-Ethereum-Realistic.gif`: animated Ethereum hero illustration used on the page.
- `/hero-image.png`: previous static hero illustration, retained as an asset.
- `/logo-1.png`: supplied compact mark, paired with a text wordmark in the header.
- `/logo-2.png`: supplied wide wordmark in the footer. A clipped CSS overlay
  lightens its dark lettering while preserving the green artwork on the black
  background. The original file is unchanged.
- Existing Inter font from `features/security/assets/Inter-Latin.woff2`.

The smaller symbols are inline SVGs. No extra images or packages are required.
The duplicate `logo-1.jpeg` is not used by this page.

## Interactions

Navigation links scroll to their sections and indicate the active section.
The mobile menu opens, closes, and returns focus to its toggle on Escape.
Get Started links open `/register`. Workflow and capability cards open native
modal dialogs, with keyboard focus containment, Escape handling and focus return.
Resource and contact links lead to the project's GitHub repository or wiki.
No public X account was supplied, so no X profile link is invented.

The Privacy and Terms controls display preview notices; they are not production
legal policies. FAQ and feature details explain the current mock behavior and
planned integrations.

## Verification and handoff

Run `npm run dev:web`, then open the Local URL printed by Vite, normally
`http://localhost:5173/`. Build and lint passed, and the local home route and all
three supplied image assets returned HTTP 200. A browser was not connected for
visual comparison or interaction checks.

Review desktop and phone widths, the mobile menu, section navigation, feature
dialogs and Get Started before opening a PR. In particular, compare the footer
wordmark treatment to the supplied logo at its final display size.

No commits were made. This is one cohesive commit once reviewed:
`feat(web): add ChainOps landing page`. Include this feature, `src/App.tsx`,
`index.html`, and the three used PNG assets. Keep unrelated sprint notes and the
unused JPEG out of that commit unless they are intentionally part of the change.
