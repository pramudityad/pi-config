---
name: ecc-context-switch
description: Show a dashboard of active work across all CloudEats repos and worktrees. Find where a ticket is checked out, view uncommitted changes, and quick-switch between existing contexts. Triggers on phrases like "what am I working on", "active branches", "where is DP-7168", or "show my work status".
---

# Context Switch

Quick navigation and status across all your active work contexts.

## Usage

### Show Active Contexts

```
What am I working on?
```

Shows:
- All repos with uncommitted changes
- Active branches across all repos
- Recent worktrees with their tickets
- Last commit per location

### Find Where a Ticket Is

```
Where is DP-7168?
```

Searches all repos and worktrees for branches matching the ticket ID.

### Quick Status Dashboard

```bash
~/.pi/agent/skills/ecc-context-switch/status.sh
```

Output:
```
## Active Work Contexts

### Modified (uncommitted changes)
📁 safaraya-service [DP-7180-field-rejection]
   M src/services/rejection.service.ts
   ?? tests/rejection.test.ts

📁 menu-api [DP-7179-category-sort]
   M src/controllers/category.controller.ts

### Recent Worktrees
📁 .worktrees/DP-7175-submit (safaraya-service)
   Branch: DP-7175-dev
   Last: abc1234 "Add batch submit endpoint"

📁 .worktrees/edit-registration (safaraya-service)  
   Branch: edit-registration-dev
   Last: def5678 "Fix validation"

### Clean Repos
✅ order-api [dev-alfred]
✅ kitchen-api [sit-alfred]
✅ feedback-api [dev-alfred]
```

## Quick Switch Commands

### By Ticket
```bash
# Opens new terminal tab in the worktree
~/.pi/agent/skills/ecc-context-switch/switch.sh DP-7168
```

### By Repo
```bash
~/.pi/agent/skills/ecc-context-switch/switch.sh menu-api
```

### List All Options
```bash
~/.pi/agent/skills/ecc-context-switch/switch.sh --list
```

## Integration

Works with:
- `cloudeats-git-checkout` skill for creating new branches
- `clickup` skill for ticket details
- `git-worktrees` skill for creating new worktrees
