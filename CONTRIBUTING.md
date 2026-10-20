# Contributing to ChainOps

ChainOps is a five-member academic project for smart-contract DevSecOps. We use GitHub Issues and Projects to plan work, pull requests to review it, and the GitHub Wiki to explain design decisions and system behavior.

> **Current phase:** OOAD diagrams and system design. The rules below also apply during implementation, with additional checks added when code exists.

## 1. Before you start

1. Pick an assigned **repository Issue** (not a GitHub Projects draft item).
2. Read its scope and acceptance criteria; check for dependencies and duplicates.
3. Update the issue's GitHub Projects status to **In Progress**.
4. Create one focused branch from the **agreed integration branch**. Confirm that branch in the repository before starting; do not assume it is `main`.

## 2. Branch names

Format: `<type>/issue-<number>-<short-description>`

```text
docs/issue-4-m1-workflow-diagrams
docs/issue-15-m2-deployment-erd
docs/issue-18-m3-monitoring-sequence
feat/issue-32-github-webhook
fix/issue-48-deployment-timeout
```

- `issue-4` refers to the actual issue number, **#4**.
- Use lowercase and hyphens; keep names descriptive.
- During the design phase, use `docs/` for UML, ERD, specifications, and supporting documentation.
- Usually use **one branch and one PR per issue**; a branch may have many commits.

## 3. Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/):

`<type>(<scope>): <imperative description>`

```text
docs(m1): add pipeline use case diagrams
docs(m1): refine webhook failure activity flow
docs(m2): model deployment transaction sequence
docs(m3): correct event indexing ER cardinalities
docs(m4): update release approval class diagram
docs(m5): add workspace membership use cases
```

| Type | Purpose |
| --- | --- |
| `docs` | Diagrams and documentation (use this most often now) |
| `feat` | New functionality, later |
| `fix` | Fix behavior, later |
| `refactor` | Code-only structural improvements, later |
| `test` | Tests, later |
| `chore` | Tooling and maintenance |
| `ci` | Automation and CI workflows |

Use `m1`–`m5` for module scope, or `shared`, `architecture`, `wiki`, or `repo` for shared changes. Avoid `final`, `updates`, `done`, and huge mixed commits.

## 4. Pull requests

**PR title format:** `<type>(<scope>): <summary>`

Example: `docs(m1): add pipeline and execution workflow diagrams`

**Short PR description:**

```markdown
## Summary
Added the M1 use-case, activity, and sequence diagrams.

## Changes
- Use-case diagrams
- Activity diagrams
- Sequence diagrams

## Checklist
- [ ] UML notation checked
- [ ] Editable source files included
- [ ] Diagrams reviewed for module consistency

Closes #4
```

- Use `Closes #N` **only if the PR completes issue #N**; use `Refs #N` for partial work.
- Link the actual repository issue rather than relying on the branch name.
- Request at least **one review from another member**; ask a related module owner for cross-module changes.
- Resolve review comments and use **Squash and merge** if permitted by the repository.
- Don't push directly to a protected integration branch, force-push shared branches, or commit credentials.

### About closing issues and updating GitHub Projects

GitHub's built-in `Closes #N` issue closure normally happens when a qualifying PR is merged into the **repository's default branch**. Merging to a separate `diagram` branch will **not normally auto-close the issue**. The team must either:

1. Target the repository's default branch for completed issue PRs; **or**
2. Configure a reviewed GitHub Actions workflow that intentionally closes linked issues on merge into `diagram`.

GitHub Projects has **separate issue and PR items**. To track only issues, configure Auto-add filtering for `is:issue`. Moving the issue to **In Review** when a PR opens is manual until a custom automation is installed. The built-in **Item closed → Done** workflow can update the existing issue's project item after it closes. Do not claim these automations are enabled until the team verifies them.

## 5. OOAD diagram quality rules

Current issues are organized as **two design tasks per member**: (1) use-case, activity, sequence workflows and (2) class, ER/data models.

- Follow the department's taught UML/ER notation: actors and system boundary, correct `«include»`/`«extend»`, activity guards and endpoints, sequence messages, class associations and multiplicities, ER attributes and keys.
- Use descriptive, consistent diagram filenames, e.g., `m1-pipeline-activity.drawio` or `m2-deployment-class.puml`.
- Commit **editable sources** (`.drawio`, `.puml`, etc.) and readable exports (`.svg` or `.pdf`) when useful.
- Check diagram readability, labels, cross-module terminology, and consistency with agreed requirements.
- Keep source diagrams in version-controlled `docs/diagrams/`; use the Wiki for explanations and links to authoritative files.
- If a decision remains unconfirmed, note it as **Proposed** or **Open**, not finalized.

## 6. Issue lifecycle and Definition of Done

`Todo → In Progress → In Review → Done`

A design issue is **Done** when its assigned diagrams are complete, editable files are committed, notation and module dependencies are reviewed, the PR is merged to the agreed branch, and the issue/project status reflects the team's completion policy. A PR being opened does not by itself complete the issue.

For development tasks later, add test evidence, implementation notes, and relevant security checks.

## 7. Documentation: repository vs Wiki

- `README.md`: concise introduction and navigation.
- `CONTRIBUTING.md`: contribution policy, maintained in the main repository.
- `docs/`: source-controlled requirements, diagrams, decisions and other authoritative artifacts.
- [Wiki](https://github.com/intelli-collective/ChainOps/wiki): understandable explanations, module overviews, terminology, decisions, team onboarding, and links to source files.
- Avoid maintaining two conflicting copies of a diagram or specification. Prefer linking from the Wiki to the repository file.

## 8. Suggested everyday commands

```bash
# Run from the local repository; replace <integration-branch> and issue details.
git fetch origin
git switch <integration-branch>
git pull --ff-only origin <integration-branch>
git switch -c docs/issue-4-m1-workflow-diagrams

# After editing:
git status
git add docs/diagrams/
git commit -m "docs(m1): add pipeline activity diagrams"
git push -u origin docs/issue-4-m1-workflow-diagrams
```

Create a PR against the **team-agreed target branch**. Check both PR base and issue-linking behavior before merging.

---

**Questions or exceptions:** discuss them in the related issue or PR so the decision remains traceable.