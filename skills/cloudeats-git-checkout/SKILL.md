---
name: cloudeats-git-checkout
description: Use when the user wants to work on a task/ticket in a specific CloudEats repo and environment. Triggers on phrases like "work on V2-5413 in order-api for dev", "checkout V2-5413 kitchen-api sit", or "switch to V2-5413 in menu-api for stg".
---

# CloudEats Git Checkout

Handles checking out the correct environment branch and creating feature branches in CloudEats microservice repos.

## HARD GATE — Workspace Check

Before doing ANYTHING, verify the current working directory is within:
```
/Users/FLP9damarpramuditya/Project/Cloudeats
```

Run:
```bash
pwd
```

If the output does NOT start with `/Users/FLP9damarpramuditya/Project/Cloudeats`, STOP and tell the user:
> "This skill only works inside the CloudEats workspace (`/Users/FLP9damarpramuditya/Project/Cloudeats`). Please navigate there first."

Do NOT proceed.

## Extract Parameters

From the user's message, extract exactly three values:

| Parameter   | Example        |
|-------------|----------------|
| **TICKET**  | `V2-5413`      |
| **REPO**    | `order-api`    |
| **ENV**     | `dev`          |

If any are missing or ambiguous, ask the user to clarify. Do NOT guess.

## Valid Repos

```
central-gateway, kitchen-api, order-api, inventory-api,
menu-api, feedback-api, frontend-admin, frontend-pos,
frontend-ops, robin-components, infra-env-variables,
central-registry, ftp-api, partner-auth-api
```

If the REPO is not in this list, show the list and ask the user to pick one.

## Environment → Base Branch Mapping

| ENV      | Base Branch   |
|----------|---------------|
| `dev`    | `dev-alfred`  |
| `sit`    | `sit-alfred`  |
| `stg`    | `stg-alfred`  |
| `master` | `master`      |

If ENV is not one of `dev`, `sit`, `stg`, `master`, ask the user to clarify.

## Workflow — Execute These Steps In Order

### Step 1: Check for dirty working tree

```bash
cd /Users/FLP9damarpramuditya/Project/Cloudeats/{REPO}
git status --porcelain
```

If there is output (dirty tree), STOP and ask the user:
> "There are uncommitted changes in `{REPO}`. Do you want to:"
> - **A)** Stash them (`git stash`)
> - **B)** Abort

If A → run `git stash` then continue.
If B → stop entirely.

### Step 2: Fetch latest

```bash
git fetch origin
```

### Step 3: Checkout base branch and pull

Look up the base branch from the mapping table above. Then:

```bash
git checkout {BASE_BRANCH}
git pull origin {BASE_BRANCH}
```

If the base branch does not exist locally or on remote, STOP and tell the user:
> "Base branch `{BASE_BRANCH}` does not exist in `{REPO}`. Please verify the remote has this branch."

### Step 4: Check if feature branch exists

The feature branch name is: `{TICKET}-{ENV}`

Check both local and remote:

```bash
git branch --list "{TICKET}-{ENV}*"
git branch -r --list "origin/{TICKET}-{ENV}*"
```

#### If `{TICKET}-{ENV}` exists (local or remote):

Ask the user:
> "Branch `{TICKET}-{ENV}` already exists in `{REPO}`. Do you want to:"
> - **A)** Resume work on it (checkout the existing branch)
> - **B)** Create a fresh branch with an incremented suffix

**If A (resume):**
```bash
git checkout {TICKET}-{ENV}
```
If it's only on remote:
```bash
git checkout -b {TICKET}-{ENV} origin/{TICKET}-{ENV}
```

**If B (fresh branch):**
Find the highest existing suffix number from the branch listings (e.g., if `V2-5413-dev`, `V2-5413-dev-1` exist, next is `V2-5413-dev-2`). Then:
```bash
git checkout -b {TICKET}-{ENV}-{NEXT_NUMBER}
```

#### If `{TICKET}-{ENV}` does NOT exist:

```bash
git checkout -b {TICKET}-{ENV}
```

### Step 5: Confirm

Print a summary:

> ✅ **Ready to work**
> - **Ticket:** {TICKET}
> - **Repo:** {REPO}
> - **Environment:** {ENV}
> - **Branch:** {BRANCH_NAME}
> - **Based off:** {BASE_BRANCH}

## Rules

- NEVER skip the workspace check
- NEVER guess missing parameters — always ask
- NEVER force-push or delete branches
- Always fetch before checkout
- Always pull the base branch before creating a feature branch
