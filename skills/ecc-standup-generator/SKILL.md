---
name: ecc-standup-generator
description: Generate daily standup summaries by combining ClickUp tasks and recent git commits. Triggers on phrases like "generate standup", "daily summary", "what did I work on", "standup report".
---

# Standup Generator

Combines ClickUp tasks and git commits to generate standup-ready summaries.

## Usage

### Quick Standup Summary

```bash
~/.pi/agent/skills/ecc-standup-generator/standup.sh
```

Outputs:
- **Yesterday's commits** across all CloudEats repos
- **Current ClickUp tasks** (in progress)
- **Overdue items** from ClickUp

### Full Report (with task details)

```bash
~/.pi/agent/skills/ecc-standup-generator/standup.sh --full
```

## Output Format

```
## Standup - 2024-03-30

### ✅ Completed Yesterday
- [safaraya-service] DP-7175: Add batch submit endpoint (3 commits)
- [menu-api] Fix category sorting bug (1 commit)

### 🔄 In Progress
- DP-7180: Implement field-level rejection (safaraya-service)
  Status: in progress | Priority: high

### ⏰ Overdue
- DP-7168: Submit registration flow (due 2024-03-28)

### 📋 Next Up
- DP-7182: API evidence for rejection endpoints
```

## Configuration

Set in `~/.pi/agent/skills/ecc-standup-generator/config.json`:

```json
{
  "repos": [
    "/Users/FLP9damarpramuditya/Project/Cloudeats/safaraya-service",
    "/Users/FLP9damarpramuditya/Project/Cloudeats/menu-api",
    "/Users/FLP9damarpramuditya/Project/Cloudeats/kitchen-api",
    "/Users/FLP9damarpramuditya/Project/Cloudeats/order-api",
    "/Users/FLP9damarpramuditya/Project/Cloudeats/feedback-api"
  ],
  "clickupTeamId": "3688330",
  "authorEmail": "your.email@example.com"
}
```

## Integration with ClickUp Skill

This skill uses the ClickUp CLI. Ensure it's configured:

```bash
npx @krodak/clickup-cli init
```
