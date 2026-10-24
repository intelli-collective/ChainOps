# ChainOps — Member 3 — Monitoring, Events & Alerts Codex Implementation Handoff

> **Purpose:** Give this entire file to Codex together with the ChainOps repository and the listed reference files.  
> **Primary goal:** Implement the assigned member's vertical slice as real working application functionality, not a collection of static screenshots.

---

## 1. Required references

Before editing code, inspect all available project material and the current repository.

### Figma — visual source of truth

Main compact Figma file:

https://www.figma.com/design/WS4Vdr0VXtoBYKx1FatKyX/ChainOps-%E2%80%94-Wireframes---Interactive-UI--Copy---Copy-?node-id=2097-26625&t=hDVXpJ56Et8ie0Sc-1

A `.fig` export of this same design may also be attached. Use the live Figma file when available because it is easier to inspect exact frame names, spacing, visual hierarchy, icons, and state variants.

### Project files Codex should receive

Prefer attaching these files to the Codex task:

- `ChainOps_Project_Context.md`
- `ChainOps_Master_LLM_Context (1).md`
- `04_intelli_Coders_Final_Proposal.pdf`
- `CONTRIBUTING.md`
- the current compact `.fig` export
- the current ChainOps repository / working branch

Also inspect any current repository files that define:

- architecture decisions
- current database schema and migrations
- shared DTOs/types
- API contracts
- route definitions
- authentication/session implementation
- design tokens
- shared layout/components
- environment configuration
- test setup
- README/setup instructions

Do **not** replace current repository decisions with older proposal options when the repository already contains a finalized implementation.

---

## 2. Confirmed project model

ChainOps is a Smart Contract DevSecOps and Operations Platform.

The traceability chain is:

`GitHub commit -> pipeline run -> compile -> tests -> security scan -> policy decision -> validated artifact -> approval -> deployment transaction -> contract address -> blockchain events -> alerts -> notifications/audit`

Architecture principles that must remain intact:

- GitHub remains the source of truth for source code.
- Do not store full repositories in PostgreSQL.
- Long-running execution is asynchronous: API -> queue -> worker.
- Developer-controlled repository code must run in isolated temporary execution environments rather than directly on the API host.
- Exact commit/source revision traceability must be preserved.
- Security analyzer output and governance policy decisions are separate concerns.
- Deployment request, transaction submission, and transaction confirmation are separate lifecycle states.
- Important processing must be idempotent where duplicate delivery is possible.
- AI is read-oriented and must not become a privileged execution dependency.
- Secrets, RPC credentials, tokens, private keys, webhook secrets, and environment-variable values must not be exposed in client code or committed.

Each member owns a **vertical technical slice** and should contribute UI, backend/API, database work where applicable, technical mechanism, integration, tests, and cross-module integration.

---

## 3. Repository and Git rules

Follow `CONTRIBUTING.md`.

Before implementation:

1. Inspect the existing codebase.
2. Reuse the current app architecture.
3. Do not create a second React app, second router, duplicate NestJS app, duplicate global layout, or conflicting design system.
4. Follow existing linting, formatting, testing, naming, folder structure, DTO, service, repository, and state-management conventions.
5. Keep changes within this member's ownership except for the smallest necessary shared integration edits.
6. Avoid broad unrelated refactors.

Git convention:

`<type>/issue-<number>-<short-description>`

For implementation normally use:

`feat/issue-<ISSUE_NUMBER>-<short-description>`

Use Conventional Commits, e.g.:

`feat(m1): ...`
`feat(m2): ...`
`feat(m3): ...`
`feat(m4): ...`
`feat(m5): ...`

or use `web`, `api`, `repo`, `test`, etc. when more accurate.

PR title must also use Conventional Commit style.

PR description should include:

```md
## Summary
What this PR implements.

## Changes
- Main change
- Main change
- Main change

## Testing
- Commands/checks performed

## Checklist
- [ ] Changes reviewed locally
- [ ] Relevant tests updated
- [ ] No secrets or unrelated files included

Closes #ISSUE_NUMBER
```

---

## 4. Critical Figma interpretation rules

### 4.1 Sign-in/sign-up duplicate frames are NOT separate pages

The compact Figma contains duplicate/variant sign-in/sign-up frames used to demonstrate password visibility/hiding.

**Do not implement them as separate routes or separate pages.**

Implement:

- one Sign In page/component
- one Sign Up page/component
- show/hide password as interactive component state
- same layout remains mounted when visibility toggles
- use correct accessible button labels such as "Show password" / "Hide password"
- preserve cursor/focus and input value

This rule applies even when scanning the whole Figma for frame count.

### 4.2 Figma states are application states, not automatically routes

Frames such as:

- running vs passed vs failed
- invalid parameters
- preflight blocked
- deployment pending/confirmed/failed/unknown
- watcher editing/saved
- alert acknowledged/resolved
- approval approved/changes requested

should normally be implemented as stateful views of the same domain resource or flow unless the existing router intentionally separates them.

Do not create unnecessary routes simply because Figma shows multiple state frames.

### 4.3 Missing number 14 is not a missing feature

The Figma numbering does not require a new "frame 14" implementation. Do not invent a page only to fill the numbering gap.

---

## 5. Shared visual and interaction requirements

The implementation must look like the supplied compact Figma, but it must also behave like a real application.

### 5.1 Design fidelity

Match:

- background and surface colors
- typography hierarchy
- card borders and corner radius
- spacing
- sidebar width
- header height
- button sizes
- table density
- badges/status pills
- tabs
- input styling
- empty states
- icon size and alignment
- responsive behavior

Do not "improve" the design into a different visual language unless an existing shared component in the repository already defines the final style.

Avoid:

- gradients that do not exist in Figma
- random shadows
- different background colors
- emoji as icons
- oversized decorative illustrations
- arbitrary new accent colors
- member-specific UI styles

### 5.2 Icons — exact-match requirement

Do not substitute random icons.

For each visible icon:

1. Inspect the Figma icon/layer and its exact appearance.
2. Inspect the repository's installed icon library first.
3. If the exact icon exists there, use it.
4. If it does not, use internet/web search when available to identify the same or visually exact open-source/public icon from a reputable source/library.
5. Prefer a proper package import or locally stored project asset rather than runtime hotlinking.
6. Keep the same visual style, stroke weight, fill style, size, and alignment as Figma.
7. Use official brand icons for brands such as GitHub.
8. Do not mix filled icons and outline icons arbitrarily.
9. Do not redraw recognizable icons with CSS.
10. If the exact Figma vector is an allowed project asset and no public icon library match exists, use the Figma-exported SVG as the fallback.

Potential public libraries may include Lucide, Heroicons, Material Symbols, or Simple Icons, but **do not assume a library solely because it is popular**. Match the Figma visual first.

### 5.3 Shared header

The actual compact Figma header includes:

- global search
- Notifications / Unread control
- bell icon
- compact user profile
- avatar
- chevron-down

These controls must not remain decorative.

#### Notification popup / dropdown

The global bell control should use one shared notification-popover implementation owned by the platform/shared UI.

Required behavior:

- click/tap bell toggles an anchored popup/popover
- show unread state/count/dot according to available data
- show a small list of recent notifications
- distinguish unread/read visually
- include useful timestamp/context
- clicking a notification should navigate to its related resource when a valid target exists
- include "View all notifications" / equivalent that opens the full Notifications page
- use real notification data when the shared API exists
- include loading, empty, and error states
- allow mark-as-read if supported by the current backend contract
- close on outside click
- close on Escape
- manage focus sensibly
- use appropriate ARIA attributes
- do not create five separate notification systems

M5 owns the shared notification domain/component. M1-M4 should reuse it after integration rather than duplicate it.

#### Profile popup / dropdown

The avatar/profile control should also be interactive.

Required behavior:

- click avatar/profile/chevron opens an anchored menu
- show current user identity from the real auth/session state
- show only menu actions that map to real supported routes/features
- at minimum expose the current identity and a working sign-out action when authentication is implemented
- profile/account/settings links should use existing routes if present
- role/context may be displayed when available
- close on outside click and Escape
- use keyboard/focus accessibility
- do not create dead links
- sign-out must call the actual auth/session logout flow and clear client state correctly

### 5.4 Global search

The global search field must not be a fake editable rectangle.

Inspect existing search behavior first.

If a shared search API/component exists:

- reuse it
- support relevant project/org resources
- show loading/empty/error states
- make results navigable

If no search backend exists yet, implement the smallest safe integration boundary without inventing unrelated backend scope. Do not create misleading fake results.

### 5.5 Menus, popovers, dialogs, forms

Every clickable-looking control should either:

- perform the intended action,
- navigate to a real destination,
- open a real popover/dialog,
- or be explicitly disabled with a reason.

Avoid dead buttons.

Use:

- client-side validation
- server-side/API error handling
- loading/disabled submission states
- duplicate-submit protection
- confirmation dialogs for genuinely consequential actions
- toasts/inline feedback where appropriate
- accessible labels and focus handling

### 5.6 Page states

Every data-driven screen should handle as applicable:

- initial loading
- empty data
- populated data
- API/server error
- permission denied / unauthorized
- disabled action due to state
- submitting/mutating state
- successful mutation
- stale/in-progress state

Do not implement only the "happy-path screenshot".

### 5.7 Responsive behavior

Desktop Figma is the primary target, but avoid brittle absolute positioning.

Use normal React layout techniques:

- CSS grid/flex
- reusable layout components
- responsive table overflow
- stable sidebars/header
- sensible content max widths
- no overlapping content when text expands

Do not convert Figma into a giant set of fixed `left/top` coordinates.

---

## 6. Exact shared navigation from the current Figma

### Organization navigation

Use these exact labels:

- Projects
- People / Roles
- Integrations
- Settings

### Project navigation

Use these exact labels/groups from the current compact Figma:

- Dashboard

**BUILD**
- Build (CI) Pipeline
- Security Scans

**RELEASE**
- Release (CD) Pipelines
- Approvals
- Deployments
- Contract Registry
- Smart Contracts

**OPERATE**
- Monitoring
- Alerts
- Audit
- Notifications
- AI Assistant

**MANAGE**
- Environments
- Environment Variables
- Team Info
- Settings

Do not rename the sidebar independently in one member's branch.

M5 owns the shared shell/navigation implementation. Other members should plug their routes/pages into it and keep their module components independently mergeable.

---

## 7. Shared data/integration rules

Cross-module information does **not** transfer domain ownership.

Examples:

- M2 may display pipeline run and approval evidence but does not own the pipeline or approval engine.
- M4 may display build/test evidence but does not own build/test execution.
- M3 may display contract deployment metadata but does not own deployment.
- M5 dashboard may summarize all domains but does not duplicate their domain state machines.

Prefer shared IDs and APIs:

- `projectId`
- `commitSha`
- `pipelineRunId`
- `artifactId`
- `securityScanId`
- `policyResultId`
- `approvalId`
- `deploymentId`
- `transactionHash`
- `contractId`
- `alertId`

Use the repository's actual names/types where they already exist.

Do not create a second source of truth.

---

## 8. Security baseline

The following are non-negotiable:

- no secrets in frontend bundles
- no private keys in source control
- no plaintext secret values returned after storage
- no raw GitHub/webhook secrets in UI
- no bypassing backend authorization because a button is hidden
- no trusting client-side RBAC alone
- validate all state-changing API requests
- use existing CSRF/session/JWT protection correctly
- preserve org/project authorization boundaries
- avoid logging secrets
- avoid unsafe `dangerouslySetInnerHTML` for logs/scanner output
- sanitize/escape untrusted content
- do not execute repository-generated HTML/JS in the browser
- do not run developer repository code directly inside HTTP request handlers

---

## 9. Testing and verification

Before finishing:

- run repository lint command
- run TypeScript typecheck if configured
- run relevant frontend tests
- run relevant backend tests
- run build
- verify assigned screens manually
- verify loading/empty/error states
- verify key mutations
- verify authorization behavior
- verify no new console errors
- verify no broken routes
- verify icons visually against Figma
- verify popup menus close correctly
- verify no secrets were added
- verify only intended files changed

If current infrastructure permits, ensure the implemented backend endpoints can also be demonstrated independently through an API client such as Postman/curl in addition to the UI.

---

## 10. Completion report Codex must return

At the end of the task, provide:

1. Summary of what was implemented.
2. Exact Figma frames covered.
3. Routes added/changed.
4. Components added/reused.
5. API endpoints added/changed/consumed.
6. Database migrations/schema changes.
7. External integrations touched.
8. Tests added and commands run.
9. Remaining integration dependencies on other members.
10. Known limitations.
11. Suggested Conventional Commit message.
12. Suggested PR title.
13. Concise PR description using the team's template.

Do not claim success for tests that were not actually run.

# MEMBER-SPECIFIC INSTRUCTIONS — M3 MONITORING, EVENTS & ALERTS

## A. Ownership

You are implementing **Member 3 — Monitoring, Events & Alerts**.

Primary responsibilities:

- contract monitoring
- watcher configuration
- RPC/WebSocket event retrieval
- event indexing
- ABI decoding
- runtime event history
- watcher health
- monitored-contract selection
- event subscriptions
- alert rules
- alerts
- acknowledgement
- resolution

Technical flow:

`Registered contract -> watcher -> RPC/WebSocket logs -> ABI decoder -> normalized event -> rule evaluation -> alert -> acknowledgement/resolution -> M5 notification delivery`

Important conceptual separation:

- **Event** = blockchain/runtime fact
- **Alert** = rule/evaluation result that requires attention
- **Notification** = delivery mechanism that tells a user

M3 owns events and alerts. M5 owns the shared notification service/inbox.

## B. Exact Figma frames

| # | Node ID | Frame |
|---|---|---|
| 62 | `2097:33075` | `62 · M3 · monitor` |
| 63 | `2097:33314` | `63 · M3 · events` |
| 64 | `2097:33487` | `64 · M3 · decoded` |
| 65 | `2097:33598` | `65 · M3 · watchers` |
| 66 | `2097:33728` | `66 · M3 · watcherEdit` |
| 67 | `2097:33861` | `67 · M3 · watcherSaved` |
| 68 | `2097:33943` | `68 · M3 · addContract` |
| 69 | `2097:34032` | `69 · M3 · subscription` |
| 70 | `2097:34121` | `70 · M3 · alerts` |
| 71 | `2097:34277` | `71 · M3 · rules` |
| 72 | `2097:34432` | `72 · M3 · createRule` |
| 73 | `2097:34558` | `73 · M3 · alert` |
| 74 | `2097:34697` | `74 · M3 · ack` |
| 75 | `2097:34836` | `75 · M3 · resolved` |

## C. Monitoring architecture rules

- consume contracts from M2 Contract Registry
- do not create another independent contract registry
- use ABI associated with the registered contract/version
- normalize decoded event data into structured fields
- retain chain evidence such as tx hash/log index/block where available
- design event ingestion to tolerate duplicate delivery/reconnect
- preserve ordering/reorg behavior as far as current MVP supports
- handle WebSocket disconnect/RPC failure
- show watcher health truthfully
- do not invent real-time data

## D. Frame-by-frame expectations

### Frame 62 — Monitoring Overview

- watcher health/status
- monitored contract counts
- recent runtime activity
- current project/network context
- clear connected/disconnected/degraded indication
- recent events/alerts summary where Figma shows it
- data refresh without full page reload if supported
- loading/empty/error states

### Frame 63 — Contract Events

- list decoded/indexed events
- filter by contract/event/network/time if design/API supports it
- show block/transaction evidence
- event name
- contract
- timestamp
- open decoded detail
- pagination/continuation according to API
- safe handling of unknown/unmatched ABI events

### Frame 64 — Decoded Event

- event signature/name
- decoded args in structured form
- contract/version
- network
- transaction hash
- block number
- log index if available
- timestamp
- source release context where available
- link to transaction/contract details
- do not render untrusted values as HTML

### Frame 65 — Watcher Configuration

- list configured watchers/monitored contracts
- health state
- RPC mode/status
- subscriptions
- enable/disable only if current backend supports it
- edit action
- add monitored contract action
- empty/error states

### Frame 66 — Watcher edit/disconnected state

This is a state/configuration view, not necessarily a separate route.

- edit polling/WebSocket/indexing settings provided by Figma/current API
- show disconnected/degraded condition honestly
- validation
- save mutation
- preserve previous values on failure
- do not expose RPC secret credentials after storage

### Frame 67 — Watcher Settings Saved

- success state after persisted configuration
- do not create a standalone route solely for success if a toast/inline state matches architecture
- show the actual saved configuration summary
- allow return to monitoring

### Frame 68 — Add Monitored Contract

- choose from M2 Contract Registry
- show address/network/version
- avoid duplicate watcher/contract registration
- validate support
- create monitoring association
- no new Contract Registry record unless user explicitly uses M2's import flow

### Frame 69 — Add Event Subscription

- derive available events from ABI
- show event signature/parameters
- allow selecting supported events
- persist subscription
- prevent duplicate subscriptions
- safe handling when ABI missing/incompatible

### Frame 70 — Alert Inbox

- list alerts
- severity
- status
- rule/type
- affected contract
- timestamp
- search/filter from Figma
- open alert detail
- show acknowledged/resolved status accurately
- empty/loading/error states

### Frame 71 — Alert Rules

- list rules
- type
- condition
- severity
- enabled state where current domain supports it
- edit/delete only if existing scope supports it
- create rule action
- do not conflate rules with notification preferences

### Frame 72 — Create Alert Rule

- use exact Figma fields/steps
- validate rule input
- use typed condition model from backend
- avoid storing only a freeform display string when structured rule data exists
- prevent unsupported conditions
- successful save should return to rules/list or show designed success feedback

### Frame 73 — Alert detail

- alert id
- title/condition result
- severity
- status
- affected project/contract
- triggering runtime evidence
- transaction/event/block references
- rule
- created time
- acknowledgement/resolution history when available
- links to related event/contract/transaction

### Frame 74 — Acknowledged

Acknowledge means a team member has seen/accepted responsibility for the alert; it does **not** mean the underlying condition is fixed.

Implement a real state mutation:

- capture current user
- acknowledgement timestamp
- optional note only if current API/design supports it
- update status atomically
- prevent invalid repeated transition if domain disallows it
- keep original alert evidence unchanged

### Frame 75 — Resolved

Resolve should be a distinct lifecycle transition.

- record resolver/current user
- resolved timestamp
- optional resolution note if supported
- preserve acknowledgement history
- prevent resolving an already terminal state incorrectly
- do not delete the alert
- retain it for audit/history

## E. Backend/event processing

Use the current repository architecture.

Important behavior:

- watcher job/service reads registered contracts
- RPC or WebSocket listener retrieves logs
- decode via correct ABI
- normalize structured values
- persist unique chain event identity
- prevent duplicate ingestion where possible using transaction hash + log index / chain identity or current schema equivalent
- evaluate rules
- create alerts
- expose domain event for M5 notification service
- continue processing safely through reconnect/retry

Handle:

- RPC failure
- WebSocket disconnect
- missed range recovery if supported
- duplicate events
- ABI decode failure
- contract removed/disabled
- notification provider failure must not destroy the alert

## F. Integration contracts

M3 consumes:

- M2 Contract Registry
- M2 network/address/ABI context
- M5 auth/project shell

M3 produces:

- normalized contract events
- watcher status
- alert rules
- alerts
- acknowledgement/resolution state

M5 consumes alert outcomes for notifications and dashboard.

M4 may consume alert/activity evidence for cross-cutting audit/reporting without taking M3 ownership.

## G. Real-time UI

If the repository already uses WebSockets/Socket.IO:

- subscribe using the established pattern
- unsubscribe on unmount/project switch
- avoid duplicate listeners
- scope events to authorized project/org
- reconcile incoming event with cached/list data

If no real-time channel exists, use a conservative polling strategy and keep it replaceable.

## H. Demo acceptance criteria

A reviewer should be able to see:

- a registered contract selected for monitoring
- watcher config
- saved watcher
- event subscription
- indexed event list
- decoded event detail
- alert rule
- generated/seeded real alert based on a rule
- alert detail
- acknowledge action
- resolve action
- clear watcher/connection status
- API-backed state transitions

This should demonstrate event-driven blockchain monitoring, not generic CRUD.
