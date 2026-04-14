---
name: daily-compile
description: Auto-generate daily briefing and project status from git, Jira, ClickUp. Triggers on phrases like "compile my day", "morning briefing", "where was I", "note:", "inbox capture".
---

# Daily Compile Knowledge Base

Auto-compiles work context from git commits, task trackers, and inbox into Obsidian vault files.

## Commands

### Compile (full daily briefing)
```
pi, compile my day
pi, morning briefing
pi, compile
```
Runs the full pipeline: git + Jira + ClickUp → generates daily briefing + STATUS files + surfaces stale inbox.

### Quick Status (terminal only)
```
pi, where was I
pi, status
```
Prints quick context to terminal — no files written. Use for fast context switches.

### Inbox Capture
```
pi, note: Jaypee asked about 5070 follow up
pi, note CE: need to create Jira for DME
pi, note FL: design doc for roblox flow
```
Appends to INBOX.md in vault root. Auto-detects company from cwd or uses CE/FL prefix.

## Configuration

The skill reads from these locations:

### Repos
```bash
FLIP_REPOS="/Users/FLP9damarpramuditya/Flip/repo/flip_server"
CLOUDEATS_REPOS="/Users/FLP9damarpramuditya/Project/Cloudeats"
```

### Task Trackers
- CloudEats: Jira via `jiracli`
- Flip: ClickUp via `clickup-cli`

### Obsidian Vault
```bash
VAULT="/Users/FLP9damarpramuditya/Documents/Obsidian Vault"
```

## Output Files
- `$VAULT/01-Calendar/Daily/YYYY-MM-DD.md` — daily briefing
- `$VAULT/02-Projects/Flip/STATUS.md` — Flip dashboard
- `$VAULT/02-Projects/Cloudeats/STATUS.md` — CloudEats dashboard
- `$VAULT/INBOX.md` — quick capture inbox

## Implementation

### compile.sh
Main script. Orchestrates:
1. Collect git activity (last 7 days) from all repos
2. Collect Jira tasks (in progress, recently updated)
3. Collect ClickUp tasks (in progress, recently updated)
4. Detect uncommitted changes
5. Read INBOX.md for stale items
6. Generate daily briefing from template
7. Generate STATUS.md per company
8. Write all files to vault

### status.sh
Quick print to terminal:
1. Last 3 commits per company
2. Active branches
3. Tasks in progress
4. Today's inbox items

### note.sh
Inbox capture:
1. Parse company from prefix or cwd
2. Append timestamped item to INBOX.md
3. Confirm with checkmark

## Templates
See `templates/` directory for file templates used by compile.sh.
