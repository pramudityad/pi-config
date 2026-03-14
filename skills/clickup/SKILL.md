---
name: clickup
description: Use when managing ClickUp tasks, updating status, adding comments, or tracking work. Triggers include task references like "DP-7168", status updates, sprint tracking, creating subtasks, standup summaries, and checking overdue items.
---

# ClickUp CLI

## My Boards

When the user asks about "my tasks", "my sprint", or "my board", refer to:

- **Digital Products Board:** https://app.clickup.com/3688330/v/o/s/60677061
- **Team ID:** 3688330

Lightweight CLI for ClickUp task management - outputs Markdown when piped (optimized for AI context windows).

## Prerequisites

```bash
npm install -g @krodak/clickup-cli
```

## Setup

First-time setup (one-time):
```bash
npx @krodak/clickup-cli init
# Enter API token from https://app.clickup.com/settings/apps
```

## Important

**Always use `npx @krodak/clickup-cli` to run commands.** Do NOT use `cu` — on macOS it resolves to `/usr/bin/cu` (Taylor UUCP), not the ClickUp CLI.

## Common Workflows

### Parse ClickUp URLs

Extract task ID from URLs like `https://app.clickup.com/t/3688330/DP-7168`:
- The task ID is the last segment after the final `/` (e.g., `DP-7168` or the alphanumeric ID)
- Use `npx @krodak/clickup-cli task <id>` to fetch details

### Daily Workflow

```bash
# Check current sprint
npx @krodak/clickup-cli sprint

# Get standup summary
npx @krodak/clickup-cli summary

# View specific task
npx @krodak/clickup-cli task DP-7168
npx @krodak/clickup-cli task DP-7168 --json  # full API response

# Add comment after completing work
npx @krodak/clickup-cli comment DP-7168 -m "Completed in commit abc123"

# Update status
npx @krodak/clickup-cli update DP-7168 -s "in review"
npx @krodak/clickup-cli update DP-7168 -s "done"

# Create subtask
npx @krodak/clickup-cli create -n "Handle edge case" -p DP-7168
```

### Task Investigation

```bash
npx @krodak/clickup-cli task <id>              # summary view
npx @krodak/clickup-cli subtasks <id>          # child tasks
npx @krodak/clickup-cli comments <id>          # discussion thread
npx @krodak/clickup-cli activity <id>          # task + comments combined
```

### Finding Work

```bash
npx @krodak/clickup-cli tasks --status "in progress"   # my active tasks
npx @krodak/clickup-cli overdue                        # past due date
npx @krodak/clickup-cli inbox --days 3                 # recently updated
npx @krodak/clickup-cli search "payment"               # search by name
```

## Key Commands

| Command | Purpose |
|---------|---------|
| `npx @krodak/clickup-cli task <id>` | View task details |
| `npx @krodak/clickup-cli update <id> -s <status>` | Update status |
| `npx @krodak/clickup-cli update <id> --priority <p>` | Set priority (urgent/high/normal/low) |
| `npx @krodak/clickup-cli comment <id> -m "text"` | Add comment |
| `npx @krodak/clickup-cli create -n "name" -p <parent>` | Create subtask |
| `npx @krodak/clickup-cli assign <id> --to me` | Self-assign |
| `npx @krodak/clickup-cli sprint` | Current sprint tasks |
| `npx @krodak/clickup-cli summary` | Standup: completed / in-progress / overdue |
| `npx @krodak/clickup-cli subtasks <id>` | List child tasks |

## Status Values

Common statuses (varies by workspace):
- `to do`, `in progress`, `code review`, `done`, `closed`

Use fuzzy matching: `-s "prog"` matches "in progress"

## Task ID Formats

- Short: `DP-7168` (custom ID)
- Long: `abc123def` (ClickUp's internal ID)
- Both work with all commands

## Output Modes

- **Terminal**: Interactive tables
- **Piped/AI**: Markdown tables (default)
- **JSON**: Add `--json` flag for structured data

## Example: Complete Workflow

User says: *"Update DP-7168 - mark it done and add a comment with the commit hash"*

```bash
npx @krodak/clickup-cli update DP-7168 -s "done"
npx @krodak/clickup-cli comment DP-7168 -m "Implemented in commit a1b2c3d"
```

Or combined investigation:
```bash
npx @krodak/clickup-cli task DP-7168 && npx @krodak/clickup-cli subtasks DP-7168
```
