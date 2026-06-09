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

### Repos — CRITICAL: Must scan ALL sub-repos

#### Flip (multi-team structure)
```
FLIP_REPOS_ROOT="/Users/FLP9damarpramuditya/Flip/repo"
```

Flip repos are organized by team. There are **30+ git repos** across **11 team directories**:
```
Flip/repo/
├── Reconciliation-Settlement/    # R&S team repos
├── business-solutions/           # BS team repos
├── capt/                         # Captive team
│   ├── api-gateway/
│   ├── api-gateway-plugins/
│   ├── gitops-kyc-service/
│   ├── notification-service/
│   └── user-authentication-service/
├── core/                         # Core/Platform team
│   ├── bff-bangkokok/
│   ├── flip-airflow-dags/
│   ├── gitops-flip-server/
│   ├── gitops-mock-api-service/
│   ├── go-core/
│   └── mock-server/
├── dpt/                          # Digital Products & Travel team
│   ├── adapter-template/
│   ├── affiliate-service/
│   ├── biller-service/
│   ├── digital-product-lib/
│   ├── dpt-parsing-service/
│   ├── gitops-flip-dpt/
│   ├── gogogo-fe/
│   ├── gogogo-service/
│   ├── goto-adapter/
│   ├── oncall-knowledge-base/
│   ├── ordering-management-system/
│   └── safaraya-service/
├── dr/                           # Domestic Remittance team
│   ├── domestic-transfer/
│   └── gitops-qris-service/
├── emo/                          # E-Money team
│   └── offline-topup-service/
├── flip_server/                  # Legacy monolith (single repo)
├── fraud/                        # Fraud team
│   ├── fraud-contract/
│   └── fraud-service/
├── sre/                          # SRE/Infra team
│   ├── flip-tf-resources/
│   ├── gcp-tf-resources/
│   └── gitops-flip-infra/
└── super/                        # Super team
    ├── alaflip/
    ├── gitops-alaflip/
    ├── gitops-flip-sup/
    ├── insurance/
    ├── investment/
    └── super-api-automation/
```

**⚠️ NEVER only scan `flip_server/`.** Always scan ALL directories under `Flip/repo/`.
Use: `find "$FLIP_REPOS_ROOT" -maxdepth 3 -name ".git" -type d`

#### CloudEats (flat structure)
```
CE_REPOS="/Users/FLP9damarpramuditya/Project/Cloudeats"
```

Flat structure with 15+ repos at depth 1. Scan: `for repo in "$CE_REPOS"/*/`

### Task Trackers
- CloudEats: Jira via `jiracli`
- Flip: ClickUp via API (see compile.sh for list IDs)

### Obsidian Vault
```bash
VAULT="/Users/FLP9damarpramuditya/Documents/Obsidian Vault"
```

### Git Author
```bash
GIT_AUTHOR="Flip Damar Pramuditya"
GIT_EMAIL="damar.pramuditya@flip.id"
```

## ⚠️ MANDATORY Verification Checklist

When generating a morning briefing or daily compile, the agent MUST:

### Phase 1: Discovery
1. **Discover ALL repos** — run `find` on both roots, count the repos found
2. **Verify repo count** — Flip should find 30+ repos, CloudEats should find 15+
3. **If count is unexpectedly low** → STOP and debug before proceeding

### Phase 2: Git Collection
4. **Collect YOUR commits** — filter by `--author="Flip Damar Pramuditya"` OR `--author="damar.pramuditya@flip.id"`
5. **Also collect ALL team commits** — to see what happened while you were out (no author filter)
6. **Use correct date** — `date +%Y` for current year, NOT hardcoded 2025
7. **Handle OOO** — if user mentions OOO, extend `--since` to cover the full absence

### Phase 3: Cross-Check
8. **Count repos with activity** — report how many repos had commits
9. **Cross-check per team** — list each team folder (capt, core, dpt, dr, emo, fraud, sre, super) and note activity
10. **Compare with last briefing** — if available, verify no teams were missed

### Phase 4: Output Validation
11. **Summary count** — briefing must include total commit count and repo count
12. **Per-team breakdown** — Flip section must show activity per team folder
13. **Zero-activity check** — if any team folder shows 0 commits, explicitly note it (don't just omit)
14. **Active branches** — check ALL repos, not just a subset

### Phase 5: Quality Gate
15. **Self-audit** — before writing the briefing, ask: "Did I check every team folder in Flip?"
16. **If briefing says 'No activity' for Flip** → THIS IS WRONG. Re-check with broader date range and no author filter.
17. **File path check** — daily note MUST be written to `$VAULT/01-Calendar/Daily/YYYY/YYYY-MM-DD.md` (with year subfolder). NEVER write to `$VAULT/01-Calendar/Daily/YYYY-MM-DD.md`.

## Output Files
- `$VAULT/01-Calendar/Daily/YYYY/YYYY-MM-DD.md` — daily briefing (note the **year subfolder**, e.g. `2026/2026-04-20.md`)
- `$VAULT/02-Projects/Flip/STATUS.md` — Flip dashboard
- `$VAULT/02-Projects/Cloudeats/STATUS.md` — CloudEats dashboard
- `$VAULT/INBOX.md` — quick capture inbox

## Agent Execution Pattern (Preferred)

When triggered, the agent should execute these bash commands in order:

```bash
# Step 1: Count repos (VERIFICATION)
echo "Flip repos: $(find /Users/FLP9damarpramuditya/Flip/repo -maxdepth 3 -name '.git' -type d | wc -l)"
echo "CE repos: $(find /Users/FLP9damarpramuditya/Project/Cloudeats -maxdepth 2 -name '.git' -type d | wc -l)"

# Step 2: YOUR commits across ALL Flip repos (since date)
cd /Users/FLP9damarpramuditya/Flip/repo
for repo_dir in */; do
  for sub in "$repo_dir" "$repo_dir"*/; do
    if [ -d "$sub/.git" ]; then
      git -C "$sub" log --oneline --since="YYYY-MM-DD" --all --author="damar.pramuditya@flip.id"
    fi
  done
done

# Step 3: ALL commits (no author filter) for full picture
# Same loop but without --author flag

# Step 4: Active branches across ALL repos
# Same discovery loop with git branch --show-current

# Step 5: CE repos (same pattern)
# Step 6: Jira + ClickUp
# Step 7: INBOX.md
# Step 8: Write briefing to CORRECT path
# ⚠️ MUST include year subfolder: 01-Calendar/Daily/YYYY/YYYY-MM-DD.md
# Example: 01-Calendar/Daily/2026/2026-04-20.md
# NEVER write to 01-Calendar/Daily/YYYY-MM-DD.md (missing year folder)
```

## Implementation Scripts

### compile.sh
Main script. Orchestrates:
1. Collect git activity (last N days) from all repos
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
