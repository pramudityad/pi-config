---
name: finishing-development
description: Use when implementation is complete, all tests pass, and you need to decide how to integrate the work - guides completion of development work by presenting structured options for merge, PR/MR, or cleanup
---

# Finishing Development

## Overview

Guide completion of development work by presenting clear options and handling chosen workflow.

**Core principle:** Verify tests → Detect environment → Present options → Commit outstanding work → Execute choice → Clean up.

**Announce at start:** "I'm using the finishing-development skill to complete this work."

## The Process

### Step 1: Verify Tests

**Before presenting options, verify tests pass:**

```bash
# Run project's test suite
npm test / cargo test / pytest / go test ./...
```

**If tests fail:**
```
Tests failing (<N> failures). Must fix before completing:

[Show failures]

Cannot proceed with merge/PR until tests pass.
```

Stop. Don't proceed to Step 2.

**If tests pass:** Continue to Step 2.

### Step 2: Detect Environment

**Determine workspace state before presenting options:**

```bash
GIT_DIR=$(cd "$(git rev-parse --git-dir)" 2>/dev/null && pwd -P)
GIT_COMMON=$(cd "$(git rev-parse --git-common-dir)" 2>/dev/null && pwd -P)
```

This determines which menu to show and how cleanup works:

| State | Menu | Cleanup |
|-------|------|---------|
| `GIT_DIR == GIT_COMMON` (normal repo) | Standard 4 options | No worktree to clean up |
| `GIT_DIR != GIT_COMMON`, named branch | Standard 4 options | Provenance-based (see Step 6) |
| `GIT_DIR != GIT_COMMON`, detached HEAD | Reduced 3 options (no merge) | No cleanup (externally managed) |

### Step 3: Determine Base Branch

```bash
# Try common base branches
git merge-base HEAD main 2>/dev/null || git merge-base HEAD master 2>/dev/null
```

Or ask: "This branch split from main - is that correct?"

### Step 4: Present Options

**Normal repo and named-branch worktree — present exactly these 4 options:**

```
Implementation complete. What would you like to do?

1. Merge back to <base-branch> locally
2. Push and create a Pull Request / Merge Request
3. Keep the branch as-is (I'll handle it later)
4. Discard this work

Which option?
```

**Detached HEAD — present exactly these 3 options:**

```
Implementation complete. You're on a detached HEAD (externally managed workspace).

1. Push as new branch and create a Pull Request / Merge Request
2. Keep as-is (I'll handle it later)
3. Discard this work

Which option?
```

**Don't add explanation** - keep options concise.

### Step 5: Execute Choice

#### Preflight: Commit outstanding work (Options 1 & 2 only)

**`git merge` and `git push` only move committed history.** Any uncommitted or unstaged changes stay behind — the merge or PR/MR silently ends up missing your latest work. Before executing Option 1 or 2, make sure the working tree is clean.

```bash
git status --porcelain
```

**If output is empty** (clean tree): proceed to the chosen option.

**If output is non-empty** (uncommitted changes exist), commit **only the files that belong to this change** — never blanket-stage.

1. See everything that's outstanding:

```bash
git status
git --no-pager diff --stat
```

2. Identify which files belong to this work. Files this branch has already touched are almost certainly part of it — uncommitted edits to a *different* file may be unrelated and should be left out:

```bash
git diff --name-only <base-branch>...HEAD   # files this branch already changed
```

3. Stage the related files **explicitly by path** — never `git add -A` or `git add .`:

```bash
git add <path/one> <path/two> ...
```

4. Confirm exactly what's staged, then commit with a conventional message:

```bash
git --no-pager diff --cached --stat        # verify only the intended files are staged
git commit -m "<type>: <description>"       # feat / fix / chore / docs / test / refactor
```

Unrelated changes stay unstaged in the working tree — they won't enter this merge or PR/MR. Then continue to the chosen option.

> **Options 3 (Keep as-is) and 4 (Discard) skip this** — keeping preserves the tree untouched, discarding throws the work away.

#### Option 1: Merge Locally

```bash
# Switch to base branch
git checkout <base-branch>

# Pull latest
git pull

# Merge feature branch
git merge <feature-branch>

# Verify tests on merged result
<test command>

# If tests pass
git branch -d <feature-branch>
```

Then: Cleanup worktree (Step 6)

#### Option 2: Push and Create PR / MR

Commit outstanding work first (see Preflight above), then push:

```bash
# Push branch
git push -u origin <feature-branch>
```

**Detect the remote host to pick the right CLI:**

```bash
git remote get-url origin
```

**GitHub remote** (`github.com`) — use `gh`:

```bash
gh pr create --title "<title>" --body "$(cat <<'EOF'
## Summary
<2-3 bullets of what changed>

## Test Plan
- [ ] <verification steps>
EOF
)"
```

**GitLab remote** (`gitlab.com` or self-hosted GitLab) — use `glab`:

```bash
glab mr create --title "<title>" --description "$(cat <<'EOF'
## Summary
<2-3 bullets of what changed>

## Test Plan
- [ ] <verification steps>
EOF
)"
```

Then: Cleanup worktree (Step 6)

#### Option 3: Keep As-Is

Report: "Keeping branch <name>. Worktree preserved at <path>."

**Don't cleanup worktree.**

#### Option 4: Discard

**Confirm first:**
```
This will permanently delete:
- Branch <name>
- All commits: <commit-list>
- Worktree at <path>

Type 'discard' to confirm.
```

Wait for exact confirmation.

If confirmed:
```bash
git checkout <base-branch>
git branch -D <feature-branch>
```

Then: Cleanup worktree (Step 6)

### Step 6: Cleanup Workspace

**For Options 1, 2, 4:**

Check if in worktree:
```bash
git worktree list | grep $(git branch --show-current)
```

If yes:
```bash
git worktree remove <worktree-path>
```

**For Option 3:** Keep worktree.

## Quick Reference

| Option | Merge | Push | Keep Worktree | Cleanup Branch |
|--------|-------|------|---------------|----------------|
| 1. Merge locally | ✓ | - | - | ✓ |
| 2. Create PR | - | ✓ | ✓ | - |
| 3. Keep as-is | - | - | ✓ | - |
| 4. Discard | - | - | - | ✓ (force) |

## Common Mistakes

**Skipping test verification**
- **Problem:** Merge broken code, create failing PR
- **Fix:** Always verify tests before offering options

**Pushing or merging with uncommitted changes**
- **Problem:** `git push`/`git merge` only move committed history, so the PR/MR or merge silently omits the latest work
- **Fix:** Run the commit preflight before Options 1 & 2 — check `git status --porcelain`, then commit outstanding changes

**Blanket-staging with `git add -A`**
- **Problem:** Sweeps unrelated changes in the working tree into the commit, polluting the PR/MR
- **Fix:** Stage only files that belong to this change, explicitly by path, and verify with `git diff --cached --stat` before committing

**Open-ended questions**
- **Problem:** "What should I do next?" → ambiguous
- **Fix:** Present exactly 4 structured options

**Automatic worktree cleanup**
- **Problem:** Remove worktree when might need it (Option 2, 3)
- **Fix:** Only cleanup for Options 1 and 4

**No confirmation for discard**
- **Problem:** Accidentally delete work
- **Fix:** Require typed "discard" confirmation

## Red Flags

**Never:**
- Proceed with failing tests
- Push or merge with uncommitted changes in the working tree
- Blanket-stage with `git add -A` / `git add .` (stage related files by path)
- Merge without verifying tests on result
- Delete work without confirmation
- Force-push without explicit request

**Always:**
- Verify tests before offering options
- Commit outstanding work before merging or pushing (Options 1 & 2), staging only the files that belong to this change
- Present exactly 4 options
- Get typed confirmation for Option 4
- Clean up worktree for Options 1 & 4 only

## Integration

**Called by:**
- **subagent-development** (Step 7) - After all tasks complete
- **executing-plans** (Step 5) - After all batches complete

**Pairs with:**
- **git-worktrees** - Cleans up worktree created by that skill
