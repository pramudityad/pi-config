---
name: jiracli
description: Jira CLI for viewing, updating, and managing Jira tickets.
---

# Jira CLI

Command-line interface for Jira operations.

## Installation

```bash
cd ~/.pi/agent/skills/pi-skills/jiracli
npm install -g .
```

## Setup

### 1. Create API Token
- Go to: https://id.atlassian.com/manage-profile/security/api-tokens
- Click "Create API token"
- Name it: `pi-jiracli-{your-device}`
- Copy the token (you won't see it again)

### 2. Configure jiracli

```bash
jiracli config
```

Enter:
- Base URL: `https://cloudeatsgroup.atlassian.net`
- Email: your work email
- API Token: paste the token from step 1

Credentials are stored in `~/.jiracli/config.json`

## Usage

### View Ticket
```bash
jiracli view V2-5413
```
Shows: summary, status, type, priority, assignee, reporter, dates, description

### List My Open Tickets
```bash
jiracli list
```

### List by Status
```bash
jiracli list --status "In Progress"
jiracli list --status "Done"
```

### Add Comment
```bash
jiracli comment V2-5413 "Fixed in commit abc123"
jiracli comment V2-5413 "Deployed to staging, ready for QA"
```

### Transition Ticket
```bash
jiracli transition V2-5413 "In Progress"
jiracli transition V2-5413 "Code Review"
jiracli transition V2-5413 "Done"
```

### Get Available Transitions
If you use an invalid transition name, the CLI will show available options.

### Assign Ticket
```bash
jiracli assign V2-5413          # Assign to yourself
jiracli assign V2-5413 <user>   # Assign to specific user
```

## Common Workflows

### Start Working on a Ticket
```bash
jiracli view V2-5413
jiracli transition V2-5413 "In Progress"
```

### Submit for Review
```bash
jiracli comment V2-5413 "PR: https://github.com/..."
jiracli transition V2-5413 "Code Review"
```

### Mark as Done
```bash
jiracli comment V2-5413 "Merged and deployed to production"
jiracli transition V2-5413 "Done"
```

## Data Storage

- `~/.jiracli/config.json` - Credentials (baseUrl, email, token)

## Troubleshooting

**401 Unauthorized:**
- Check API token hasn't expired
- Verify email matches your Atlassian account
- Run `jiracli config` to update credentials

**404 Not Found:**
- Check ticket key (e.g., V2-5413)
- Verify you have permission to view the ticket

**Transition not found:**
- Use exact transition name from your Jira workflow
- Run transition command with wrong name to see available options
