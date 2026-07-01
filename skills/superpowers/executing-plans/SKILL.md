---
name: executing-plans
description: Use when you have a written implementation plan to execute in a separate session with review checkpoints
---

# Executing Plans

## Overview

Load plan, review critically, execute tasks in batches, report for review between batches.

**Core principle:** Batch execution with checkpoints for architect review.

**Announce at start:** "I'm using the executing-plans skill to implement this plan."

## The Process

### Step 1: Load and Review Plan
1. Read plan file
2. Review critically - identify any questions or concerns about the plan
3. If concerns: Raise them with your human partner before starting
4. If no concerns: Create TodoWrite **and a durable progress file**, then proceed

**Progress file (mandatory):** Alongside in-memory TodoWrite, create `docs/plans/<plan-name>-progress.md` — a checkbox list mirroring the plan's tasks. This is the durable source of truth that lets a fresh session, another agent, or a resumed run pick up mid-plan. In-memory todos alone vanish when the session ends, so a crash or handoff would otherwise force a restart from scratch.

### Step 2: Execute Batch
**Default: First 3 tasks**

For each task:
1. Mark as in_progress (TodoWrite **and** the progress file)
2. Follow each step exactly (plan has bite-sized steps)
3. Run verifications as specified
4. Mark as completed in **both** TodoWrite and `docs/plans/<plan-name>-progress.md` before moving on — update the progress file immediately per task, never batched, so an interrupted run resumes from the exact task. Commit the progress update with each task (or batch) so status survives a crash.

### Step 3: Report
When batch complete:
- Show what was implemented
- Show verification output
- Say: "Ready for feedback."

### Step 4: Continue
Based on feedback:
- Apply changes if needed
- Execute next batch
- Repeat until complete

### Step 5: Complete Development

After all tasks complete and verified:
- Announce: "I'm using the finishing-development skill to complete this work."
- Use finishing-development skill
- Follow that skill to verify tests, present options, execute choice

### Resuming an interrupted plan
If a plan was only partially executed (fresh session, crash, or handoff):
1. Read **both** the plan file and `docs/plans/<plan-name>-progress.md`
2. Skip tasks already checked off; re-verify the last completed task's output still holds
3. Resume from the first unchecked task — do not restart from the top

For subagent-driven chains, pass the persisted `runId` to the `subagent` tool to skip already-completed steps automatically (the tool records state to `.pi/runs/<id>.json` and reports the id when a chain fails). See **subagent-development**.

## When to Stop and Ask for Help

**STOP executing immediately when:**
- Hit a blocker mid-batch (missing dependency, test fails, instruction unclear)
- Plan has critical gaps preventing starting
- You don't understand an instruction
- Verification fails repeatedly

**Ask for clarification rather than guessing.**

## When to Revisit Earlier Steps

**Return to Review (Step 1) when:**
- Partner updates the plan based on your feedback
- Fundamental approach needs rethinking

**Don't force through blockers** - stop and ask.

## Remember
- Review plan critically first
- Follow plan steps exactly
- Don't skip verifications
- Reference skills when plan says to
- Between batches: just report and wait
- Stop when blocked, don't guess
- Update the durable progress file after every task — not just in-memory todos
- Never start implementation on main/master branch without explicit user consent

## Integration

**Required workflow skills:**
- **git-worktrees** - REQUIRED: Set up isolated workspace before starting
- **writing-plans** - Creates the plan this skill executes
- **finishing-development** - Complete development after all tasks
