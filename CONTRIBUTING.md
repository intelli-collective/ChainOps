# Contributing to ChainOps

This guide defines the Git and GitHub conventions for the ChainOps team. It applies to **design documentation** and **implementation** (React + Vite frontend, NestJS backend, and supporting services).

> Keep changes focused, reference the relevant GitHub issue, and use pull requests for review. One logical change can be one commit; multiple commits are not required just because multiple files changed.

## 1. Working with GitHub Issues

- Create or use an existing GitHub issue before starting a tracked task.
- Assign an owner and use the existing GitHub Project to track progress.
- Prefer **one issue → one branch → one pull request** for a focused task.
- The issue number in branch examples below is a placeholder. Always use the actual GitHub issue number.
- Avoid creating separate issues or commits for every small setup step if they belong to one deliverable.

## 2. Branch Naming

**Format**

```text
<type>/issue-<number>-<short-description>
```

**Examples**

```text
docs/issue-4-m1-workflow-diagrams
docs/issue-8-m2-data-models
chore/issue-15-project-initialization
feat/issue-21-github-webhook
fix/issue-34-pipeline-status
```

**Branch types**

| Type | Use for |
| --- | --- |
| `docs` | UML/ER diagrams, Wiki-related documentation, README, SRS |
| `chore` | Initial setup, dependencies, configuration, maintenance |
| `feat` | New application functionality |
| `fix` | Bug fixes |
| `refactor` | Code restructuring without changing behavior |
| `test` | Adding or updating tests |
| `ci` | GitHub Actions and CI/CD workflows |

**Rules:** Use lowercase and hyphens, avoid spaces, and describe the deliverable rather than the person working on it. Start your branch from the team-agreed target branch and keep it short-lived.

## 3. Commit Messages

Use **Conventional Commits**.

**Format**

```text
<type>(<scope>): <action-oriented description>
```

Common scopes: `m1`, `m2`, `m3`, `m4`, `m5`, `web`, `api`, `repo`, `docs`.

**Examples**

```text
docs(m1): add pipeline activity diagrams
docs(m4): correct approval sequence diagram
chore(repo): initialize ChainOps monorepo
chore(repo): configure linting and formatting
feat(api): add project creation endpoint
feat(web): add project dashboard
fix(m3): prevent duplicate indexed events
ci(repo): add pull request checks
```

**Guidelines**

- Write a short, specific description, starting with a verb such as `add`, `update`, `fix`, `refine`, or `configure`.
- Commit a meaningful unit of work. **One or two commits are fine for an entire repository setup** if the changes form one coherent task.
- Avoid vague messages such as `final`, `done`, `updates`, or `fix stuff`.
- Do not commit secrets, private keys, tokens, real `.env` files, build outputs, or dependency folders.

## 4. Pull Request Titles

Use the **same Conventional Commit format** as commit messages, but summarize the **whole PR**.

```text
docs(m1): add pipeline workflow diagrams
chore(repo): initialize ChainOps monorepo
feat(api): implement GitHub webhook handling
fix(web): correct pipeline status display
```

A PR may contain multiple meaningful commits; its title should describe the combined change.

## 5. Pull Request Description

Keep PR descriptions concise. Copy this template:

```markdown
## Summary
Briefly explain what this PR adds or changes.

## Changes
- First main change
- Second main change

## Checklist
- [ ] Changes reviewed locally
- [ ] Relevant diagrams / documentation / tests updated (if applicable)
- [ ] No secrets or unrelated files included

Closes #ISSUE_NUMBER
```

For diagram PRs, mention the **Use Case, Activity, Sequence, Class, or ER** diagrams changed and include editable source files. For implementation PRs, say how the changes were tested, even if it is just a brief local run check.

### Linking an Issue

- Use `Closes #4` (replace `4`) when the PR **fully completes** the issue.
- Use `Refs #4` when the PR is only **partial work** and should not close the issue.
- **Important:** GitHub's native closing keywords normally auto-close linked issues when the PR is merged into the repository's **default branch**. A merge into a non-default branch such as `diagram` does **not** automatically close the issue through the keyword alone. In that case, either complete the integration into the default branch or use a separately configured automation/manual closure.

## 6. Review and Merge Rules

1. Create a branch for the issue and push your changes.
2. Open a PR into the **team-agreed target branch**; do not assume every PR goes to `main`.
3. Add a clear title and description, and link the issue.
4. Request at least **one other team member** to review the PR.
5. Resolve review feedback before merging. For cross-module changes, involve the affected module owner.
6. Prefer **Squash and Merge** to keep the integration history clean; delete merged branches when no longer needed.
7. Do not push directly to protected/shared integration branches unless the team has explicitly agreed on an exception.

## 7. GitHub Projects Status

Track the **issue** as the task, not both the issue and its PR as duplicate tasks.

| Status | When to use |
| --- | --- |
| **Todo** | Issue created and ready |
| **In Progress** | Work has started |
| **In Review** | PR opened and awaiting review |
| **Done** | Changes accepted, merged, and issue completed |

For now, move the issue to **In Review** manually unless a GitHub Action has been configured to do so. The built-in **Item closed → Done** workflow can update the issue's project status after closure. If using project auto-add, filter for `is:issue` to avoid adding PRs as separate project tasks.

## 8. Files and Quality Checks

**Diagrams/documentation**
- Commit the **editable diagram source** (`.drawio`, `.puml`, etc.) alongside a readable exported version when useful.
- Use descriptive filenames and keep diagrams under the appropriate module documentation folder.
- Check UML notation, readability, and cross-module consistency before requesting review.

**Application code**
- Keep frontend changes in the agreed React + Vite area and backend changes in the NestJS area.
- Follow the repository's established linting, formatting, and test commands once configured.
- Keep unrelated refactoring out of task-specific PRs.

## 9. Quick Examples

**Diagram task (Issue #4)**

```text
Branch:     docs/issue-4-m1-workflow-diagrams
Commit:     docs(m1): add pipeline activity diagrams
PR title:   docs(m1): add pipeline workflow diagrams
PR footer:  Closes #4
```

**Repository initialization (example Issue #15)**

```text
Branch:     chore/issue-15-project-initialization
Commit:     chore(repo): initialize ChainOps monorepo
PR title:   chore(repo): initialize ChainOps monorepo
PR footer:  Closes #15
```

> For detailed architecture, system diagrams, module descriptions, and decisions, see the [ChainOps Wiki](https://github.com/intelli-collective/ChainOps/wiki). This file is the team's **contribution policy**, not the full project documentation.