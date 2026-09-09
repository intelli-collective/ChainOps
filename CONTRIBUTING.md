# Contributing to ChainOps

Thank you for contributing to ChainOps.

This document describes the development workflow, branching strategy, and basic contribution guidelines followed by the Intelli Coders team.

## Branching Strategy

ChainOps uses two permanent branches:

* `main` - Stable and submission-ready code.
* `dev` - Active development and integration branch.

### Working Branches

Create working branches from `dev` for meaningful changes.

Use the following naming conventions:

* `feature/<name>` - New functionality
* `fix/<name>` - Bug fixes
* `docs/<name>` - Documentation changes
* `chore/<name>` - Maintenance and configuration changes
* `refactor/<name>` - Code restructuring without changing functionality

Examples:

```text
feature/user-authentication
feature/dashboard
fix/login-validation
docs/update-srs
chore/setup-ci
refactor/user-service
```

## Pull Requests

Meaningful changes should be developed in a working branch and submitted through a Pull Request targeting `dev`.

Typical workflow:

```text
Working Branch → Pull Request → dev → main
```

Only `dev` should normally be merged into `main`.

### Small Changes

Trivial, low-risk changes may be committed directly to `dev` when creating a separate branch and Pull Request would add unnecessary overhead.

Examples include:

* Fixing a typo
* Updating a documentation link
* Correcting a small README mistake
* Minor configuration/documentation updates

Changes that affect application behavior, architecture, database structure, security, or significant functionality should use a working branch and Pull Request.

## Commit Messages

Write clear commit messages that briefly describe the change.

Examples:

```text
feat: add user authentication
fix: correct login validation
docs: update development setup
chore: configure linting
refactor: simplify user service
```

Use the following prefixes where appropriate:

* `feat:` - New functionality
* `fix:` - Bug fix
* `docs:` - Documentation
* `chore:` - Maintenance
* `refactor:` - Refactoring
* `test:` - Tests
* `style:` - Formatting/style changes

## Pull Request Guidelines

Before creating a Pull Request:

* Make sure the code builds/runs correctly.
* Test the changes relevant to your work.
* Keep the Pull Request focused on one logical change.
* Provide a clear title and description.
* Resolve review comments before merging.

## Code Review

Team members should review meaningful changes before they are merged into `dev`.

At least one team member should approve a Pull Request before merging when review is required.

## General Principles

* Do not push directly to `main`.
* Do not force-push shared branches.
* Keep commits reasonably focused.
* Keep documentation updated when significant changes are made.
* Ask the team before making major architectural or technology decisions.
* Prefer small, understandable Pull Requests over large unrelated changes.

---

**ChainOps · Intelli Coders · Intelli Collective**
