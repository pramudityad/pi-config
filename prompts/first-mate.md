---
description: First Mate orchestrator — decompose, dispatch agents in parallel worktrees, run quality pipeline, report
---
Act as my First Mate (Kun's orchestrator pattern). For the task: $@

## Phase 1 — Recon & Decomposition
1. Understand the task at a strategic level
2. Identify independent sub-tasks that can run in parallel
3. Identify which CloudEats microservice(s) are involved
4. Check git-worktrees skill for isolation needs

## Phase 2 — Dispatch
For each independent sub-task:
1. Create or reuse an isolated git worktree (use git-worktrees skill)
2. Dispatch a focused subagent into that worktree using subagent tool
3. Each subagent gets: clear task boundary, relevant context from AGENTS.md, and success criteria

Use `dispatching-parallel-agents` or `tmux` skill for parallel execution.
Use `subagent` tool with `parallel` mode when tasks are truly independent.

## Phase 3 — Quality Pipeline
For each completed sub-task, run:
1. `systematic-debugging` → adversarial review in fresh context
2. `ecc-pr-ready` → lint, typecheck, test
3. `verification-before-completion` → full verification
4. Update project memory (.pi/CLAUDE.md) with any new gotchas found

## Phase 4 — Integrate & Report
1. Resolve any cross-task conflicts
2. Update ClickUp task status
3. Summarize what was done, what was learned, what needs human review
4. Flag any decisions the captain (me) needs to make

## Guardrails
- NEVER commit directly to main/dev/sit branches (enforced by the permission-gate extension — commit/push on a protected branch is hard-blocked headless, gated by confirmation interactively)
- Always run verification-before-completion before claiming done
- If unsure about architecture decisions, ask me (the captain) — don't guess
- If a task involves production data or secrets, flag for human review
