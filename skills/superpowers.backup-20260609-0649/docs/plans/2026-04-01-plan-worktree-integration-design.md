# Plan-Worktree Integration Design

> **For AI:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.

**Goal:** Integrate writing-plans with git-worktrees so worktree is created before writing implementation plans.

**Architecture:** brainstorming creates worktree after design approval, then invokes writing-plans inside the worktree. This ensures implementation plans live in isolated workspaces from the start.

**Tech Stack:** Markdown skill files, existing pi skill system

---

## Problem

Current flow has a gap:
- `writing-plans` says "Context: This should be run in a dedicated worktree" but doesn't create one
- Worktree only created later when `executing-plans` runs
- Plans written in main repo, then worktree created separately

## Solution

After design approval in brainstorming:
1. Save design doc to main repo
2. Invoke git-worktrees to create isolated workspace
3. Invoke writing-plans inside the worktree

## Changes

### brainstorming/SKILL.md

**Current Phase 4-6:**
```
4. Present design → get approval
5. Write design doc → docs/plans/YYYY-MM-DD-<topic>-design.md
6. Invoke writing-plans
```

**New Phase 4-7:**
```
4. Present design → get approval
5. Write design doc → docs/plans/YYYY-MM-DD-<topic>-design.md (in main repo)
6. Invoke git-worktrees → creates worktree, cd's into it
7. Invoke writing-plans (now inside worktree)
```

### writing-plans/SKILL.md

- Remove: "Context: This should be run in a dedicated worktree"
- Add: Note that brainstorming guarantees worktree exists

### git-worktrees/SKILL.md

- Add brainstorming to "Called by" list
- Update integration section

## Edge Cases

**If git-worktrees fails:**
- Report failure with reason
- Ask user: proceed in current directory or abort?

**Direct invocation of writing-plans:**
- Check if in worktree
- If not: "Not in a worktree. Continue here or create one first?"
- Preserves flexibility for small plans

**Document locations:**
- Design docs: main repo (before worktree creation)
- Implementation plans: worktree (after worktree creation)

## Flow Diagram

```
brainstorming
     ↓ (design approved)
Save design doc to main repo
     ↓
git-worktrees → creates .worktrees/feature-x
     ↓
writing-plans (inside worktree)
     ↓
Plan saved to .worktrees/feature-x/docs/plans/
```

## Benefits

- Early isolation - worktree exists before planning
- Plan docs live with implementation workspace
- Design docs stay visible in main repo
- Clean skill boundaries preserved
