#!/bin/bash
# compile.sh — Daily compile: generates briefing + STATUS files
set -euo pipefail

FETCH=${FETCH:-false}
VAULT="/Users/FLP9damarpramuditya/Documents/Obsidian Vault"
FLIP_REPOS="/Users/FLP9damarpramuditya/Flip/repo"
CE_REPOS="/Users/FLP9damarpramuditya/Project/Cloudeats"
TODAY=$(date +%Y-%m-%d)
DOW=$(date +%a)
NOW=$(date +%Y-%m-%dT%H:%M:%S)
# Configurable: set DAYS env var or pass --days N
DAYS=${DAYS:-3}

# Parse CLI args
while [[ $# -gt 0 ]]; do
  case $1 in
    --days) DAYS="$2"; shift 2 ;;
    --fetch) FETCH=true; shift ;;
    *) shift ;;
  esac
done

# ─── Optional: git fetch all repos ───
if [ "$FETCH" = true ]; then
  echo "Fetching all repos (this may take ~30s)..."
  
  # Fetch Flip repos
  while IFS= read -r gitdir; do
    repo=$(dirname "$gitdir")
    repo_name=$(echo "$repo" | sed "s|${FLIP_REPOS}/||")
    git -C "$repo" fetch --quiet 2>/dev/null && echo "  ✓ flip/$repo_name" &
  done < <(find "$FLIP_REPOS" -maxdepth 3 -name ".git" -type d 2>/dev/null)
  
  # Fetch CloudEats repos
  for repo in "$CE_REPOS"/*/; do
    if [ -d "$repo/.git" ]; then
      repo_name=$(basename "$repo")
      git -C "$repo" fetch --quiet 2>/dev/null && echo "  ✓ ce/$repo_name" &
    fi
  done
  
  wait
  echo "Fetch complete."
fi

# ─── Helpers ───

get_commits() {
  local repo_path="$1"
  local since="$2"
  if [ -d "$repo_path/.git" ]; then
    git -C "$repo_path" log --oneline --since="$since days ago" --format="%ad | %s" --date=short 2>/dev/null || true
  fi
}

get_active_branch() {
  local repo_path="$1"
  if [ -d "$repo_path/.git" ]; then
    git -C "$repo_path" branch --show-current 2>/dev/null || echo "detached"
  fi
}

get_last_commit() {
  local repo_path="$1"
  if [ -d "$repo_path/.git" ]; then
    git -C "$repo_path" log -1 --format="%ad | %s" --date=short 2>/dev/null || echo "none"
  fi
}

get_uncommitted() {
  local repo_path="$1"
  if [ -d "$repo_path/.git" ]; then
    local changes
    changes=$(git -C "$repo_path" status --porcelain 2>/dev/null | wc -l | tr -d ' ')
    if [ "$changes" -gt 0 ]; then
      echo "$changes modified files"
    else
      echo "clean"
    fi
  fi
}

# ─── Collect Flip Data ───

echo "Collecting Flip data..."
FLIP_LAST_COMMIT=""
FLIP_LAST_REPO=""
FLIP_COMMITS=""
FLIP_BRANCHES=""
FLIP_UNCOMMITTED=""

# Recursively find all git repos (maxdepth 3 to cover team/repo structure)
while IFS= read -r gitdir; do
  repo=$(dirname "$gitdir")
  repo_name=$(echo "$repo" | sed "s|${FLIP_REPOS}/||")
  
  # Last commit across all repos
  last=$(get_last_commit "$repo")
  if [ -n "$last" ] && [ "$last" != "none" ]; then
    if [ -z "$FLIP_LAST_COMMIT" ] || [[ "$(echo "$last" | cut -d'|' -f1 | tr -d ' ')" > "$(echo "$FLIP_LAST_COMMIT" | cut -d'|' -f1 | tr -d ' ')" ]]; then
      FLIP_LAST_COMMIT="$last"
      FLIP_LAST_REPO="$repo_name"
    fi
  fi
  
  # Collect all commits
  commits=$(get_commits "$repo" "$DAYS")
  if [ -n "$commits" ]; then
    FLIP_COMMITS="${FLIP_COMMITS}$(echo "$commits" | while IFS= read -r line; do echo "$repo_name | $line"; done)
"
  fi
  
  # Active branches (non-main)
  branch=$(get_active_branch "$repo")
  if [ -n "$branch" ] && [ "$branch" != "master" ] && [ "$branch" != "main" ] && [ "$branch" != "dev" ] && [ "$branch" != "staging" ] && [ "$branch" != "v2" ]; then
    FLIP_BRANCHES="${FLIP_BRANCHES}| ${repo_name} | ${branch} |
"
  fi
  
  # Uncommitted changes
  uncommitted=$(get_uncommitted "$repo")
  if [ "$uncommitted" != "clean" ]; then
    FLIP_UNCOMMITTED="${FLIP_UNCOMMITTED}- \`${repo_name}\`: ${uncommitted}
"
  fi
done < <(find "$FLIP_REPOS" -maxdepth 3 -name ".git" -type d 2>/dev/null)

# ClickUp tasks (Flip) — pull from 2 specific folders
FLIP_TASKS=""
CU_TOKEN=$(python3 -c "import json; print(json.load(open('$HOME/.config/cup/config.json')).get('profiles',{}).get('default',{}).get('apiToken',''))" 2>/dev/null)
CU_FOLDERS="90168371877 90168000046"  # Travel Sprint 2026, GGG Sprint 2026
CU_CURRENT_LISTS="901614260006 901614280043 901614055578 901614222031"  # Sprint 7+8 for both folders

if [ -n "$CU_TOKEN" ]; then
  FLIP_TASKS=$(python3 << 'PYEOF'
import json, urllib.request, os

token = os.environ.get("CU_TOKEN", "")
if not token:
    # Try reading config directly
    with open(os.path.expanduser("~/.config/cup/config.json")) as f:
        cfg = json.load(f)
    token = cfg.get("profiles",{}).get("default",{}).get("apiToken","")

lists = ["901614260006", "901614280043", "901614055578", "901614222031"]
folder_names = {"901614260006": "Travel", "901614280043": "Travel",
                "901614055578": "GGG", "901614222031": "GGG"}

all_tasks = []
for list_id in lists:
    try:
        req = urllib.request.Request(
            f"https://api.clickup.com/api/v2/list/{list_id}/task",
            headers={"Authorization": token}
        )
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read())
        for t in data.get("tasks", []):
            s = t["status"]["status"]
            if s in ["done", "closed"]:
                continue
            # Filter: only tasks assigned to me (Damar)
            assignees = t.get("assignees", []) or []
            my_ids = [94812935]  # Damar P (damar.pramuditya@flip.id)
            if not any(a.get("id") in my_ids for a in assignees):
                continue
            p = "\u26aa"
            pid = t.get("priority")
            if pid and pid.get("id"):
                p = {1:"\U0001f534",2:"\U0001f534",3:"\U0001f7e1",4:"\U0001f7e2"}.get(int(pid["id"]), "\u26aa")
            cid = t.get("custom_id", "") or t.get("id", "")
            folder = folder_names.get(list_id, "?")
            sprint = t.get("list", {}).get("name", "") if isinstance(t.get("list"), dict) else ""
            all_tasks.append((folder, sprint, s, p, cid, t["name"]))
    except Exception as e:
        pass

# Group by folder
by_folder = {}
for folder, sprint, status, p, cid, name in all_tasks:
    if folder not in by_folder:
        by_folder[folder] = []
    by_folder[folder].append((sprint, status, p, cid, name))

for folder in ["Travel", "GGG"]:
    tasks = by_folder.get(folder, [])
    if not tasks:
        continue
    # Group by sprint
    by_sprint = {}
    for sprint, status, p, cid, name in tasks:
        if sprint not in by_sprint:
            by_sprint[sprint] = []
        by_sprint[sprint].append((status, p, cid, name))
    print(f"\n#### {folder} Sprint 2026")
    for sprint, items in by_sprint.items():
        print(f"\n**{sprint}**")
        print(f"| Ticket | Priority | Status | Title |")
        print(f"|--------|----------|--------|-------|")
        for status, p, cid, name in items:
            print(f"| {cid} | {p} | {status} | {name} |")
PYEOF
  )
fi

# ─── Collect CloudEats Data ───

echo "Collecting CloudEats data..."
CE_LAST_COMMIT=""
CE_LAST_REPO=""
CE_COMMITS=""
CE_BRANCHES=""
CE_UNCOMMITTED=""

for repo in "$CE_REPOS"/*/; do
  if [ -d "$repo/.git" ]; then
    repo_name=$(basename "$repo")
    
    # Last commit across all repos
    last=$(get_last_commit "$repo")
    if [ -n "$last" ] && [ "$last" != "none" ]; then
      if [ -z "$CE_LAST_COMMIT" ]; then
        CE_LAST_COMMIT="$last"
        CE_LAST_REPO="$repo_name"
      fi
    fi
    
    # Collect all commits
    commits=$(get_commits "$repo" "$DAYS")
    if [ -n "$commits" ]; then
      CE_COMMITS="${CE_COMMITS}$(echo "$commits" | while IFS= read -r line; do echo "$repo_name | $line"; done)
"
    fi
    
    # Active branches (non-main)
    branch=$(get_active_branch "$repo")
    if [ -n "$branch" ] && [ "$branch" != "master" ] && [ "$branch" != "main" ] && [ "$branch" != "dev" ] && [ "$branch" != "staging" ]; then
      CE_BRANCHES="${CE_BRANCHES}| ${repo_name} | ${branch} |
"
    fi
    
    # Uncommitted changes
    uncommitted=$(get_uncommitted "$repo")
    if [ "$uncommitted" != "clean" ]; then
      CE_UNCOMMITTED="${CE_UNCOMMITTED}- \`${repo_name}\`: ${uncommitted}
"
    fi
  fi
done

# Source formatters
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/format-jira.sh"

# Jira tasks (if CLI available and configured)
CE_TASKS=""
if command -v jiracli &>/dev/null && [ -f ~/.jiracli/config.json ]; then
  CE_TASKS_RAW=$(jiracli list --status "In Progress" 2>/dev/null || echo "")
  if [ -n "$CE_TASKS_RAW" ]; then
    CE_TASKS=$(format_jira_table "$CE_TASKS_RAW")
  fi
fi

# ─── Read Inbox ───

INBOX_FILE="$VAULT/INBOX.md"
CE_INBOX=""
FLIP_INBOX=""
if [ -f "$INBOX_FILE" ]; then
  CE_INBOX=$(grep -A1 "#ce" "$INBOX_FILE" 2>/dev/null | grep "^\- \[" || true)
  FLIP_INBOX=$(grep -A1 "#flip" "$INBOX_FILE" 2>/dev/null | grep "^\- \[" || true)
fi

# ─── Generate Daily Briefing ───

echo "Generating daily briefing..."
DAILY_FILE="$VAULT/01-Calendar/Daily/${TODAY}.md"

cat > "$DAILY_FILE" << EOF
---
type: daily-briefing
generated: ${NOW}
auto: true
---

# 📋 Daily Briefing — ${DOW}, ${TODAY}

## 🟦 CloudEats

### Where You Left Off
- **Last commit:** ${CE_LAST_COMMIT:-none} $( [ -n "$CE_LAST_REPO" ] && echo "(\`${CE_LAST_REPO}\`)" )

### Active Branches
$(if [ -n "$CE_BRANCHES" ]; then
  echo "| Repo | Branch |"
  echo "|------|--------|"
  echo -n "$CE_BRANCHES"
else
  echo "No active feature branches"
fi)

### In Progress (Jira)
$(if [ -n "$CE_TASKS" ]; then
  echo "$CE_TASKS"
else
  echo "_No Jira data — run \`jiracli config\` to enable_"
fi)

### Recent Commits (${DAYS} days)
$(if [ -n "$CE_COMMITS" ]; then
  echo "$CE_COMMITS" | while IFS= read -r line; do
    [ -n "$line" ] && echo "- $line"
  done
else
  echo "No recent commits"
fi)

### 📥 CloudEats Inbox
$(if [ -n "$CE_INBOX" ]; then
  echo "$CE_INBOX"
else
  echo "_Empty_"
fi)

---

## 🟧 Flip

### Where You Left Off
- **Last commit:** ${FLIP_LAST_COMMIT:-none} $( [ -n "$FLIP_LAST_REPO" ] && echo "(\`${FLIP_LAST_REPO}\`)" )

### Active Branches
$(if [ -n "$FLIP_BRANCHES" ]; then
  echo "| Repo | Branch |"
  echo "|------|--------|"
  echo -n "$FLIP_BRANCHES"
else
  echo "No active feature branches"
fi)

### ClickUp Tasks
$(if [ -n "$FLIP_TASKS" ]; then
  echo "$FLIP_TASKS"
else
  echo "_No ClickUp data — check API token_"
fi)

### Recent Commits (${DAYS} days)
$(if [ -n "$FLIP_COMMITS" ]; then
  echo "$FLIP_COMMITS" | while IFS= read -r line; do
    [ -n "$line" ] && echo "- $line"
  done
else
  echo "No recent commits"
fi)

### 📥 Flip Inbox
$(if [ -n "$FLIP_INBOX" ]; then
  echo "$FLIP_INBOX"
else
  echo "_Empty_"
fi)

---

## 📝 Uncommitted Changes
$(if [ -n "$CE_UNCOMMITTED" ]; then echo "### CloudEats"; echo "$CE_UNCOMMITTED"; fi)
$(if [ -n "$FLIP_UNCOMMITTED" ]; then echo "### Flip"; echo "$FLIP_UNCOMMITTED"; fi)
EOF

# ─── Generate Flip STATUS.md ───

echo "Generating Flip STATUS..."
cat > "$VAULT/02-Projects/Flip/STATUS.md" << EOF
---
type: project-status
company: flip
generated: ${NOW}
auto: true
---

# Flip — Current Status
_Last auto-updated: ${NOW}_

## Active Branches
$(if [ -n "$FLIP_BRANCHES" ]; then
  echo "| Repo | Branch |"
  echo "|------|--------|"
  echo -n "$FLIP_BRANCHES"
else
  echo "No active feature branches"
fi)

## ClickUp Tasks
$(if [ -n "$FLIP_TASKS" ]; then echo "$FLIP_TASKS"; else echo "_No ClickUp data_"; fi)

## Recent Commits (${DAYS} days)
$(if [ -n "$FLIP_COMMITS" ]; then
  echo "$FLIP_COMMITS" | while IFS= read -r line; do
    [ -n "$line" ] && echo "- $line"
  done
else
  echo "No recent commits"
fi)

## Inbox
$(if [ -n "$FLIP_INBOX" ]; then echo "$FLIP_INBOX"; else echo "_Empty_"; fi)

## Uncommitted Changes
$(if [ -n "$FLIP_UNCOMMITTED" ]; then echo "$FLIP_UNCOMMITTED"; else echo "All clean"; fi)
EOF

# ─── Generate CloudEats STATUS.md ───

echo "Generating CloudEats STATUS..."
cat > "$VAULT/02-Projects/Cloudeats/STATUS.md" << EOF
---
type: project-status
company: cloudeats
generated: ${NOW}
auto: true
---

# CloudEats — Current Status
_Last auto-updated: ${NOW}_

## Active Branches
$(if [ -n "$CE_BRANCHES" ]; then
  echo "| Repo | Branch |"
  echo "|------|--------|"
  echo -n "$CE_BRANCHES"
else
  echo "No active feature branches"
fi)

## In Progress (Jira)
$(if [ -n "$CE_TASKS" ]; then echo "$CE_TASKS"; else echo "_No Jira data — run \`jiracli config\` to enable_"; fi)

## Recent Commits (${DAYS} days)
$(if [ -n "$CE_COMMITS" ]; then
  echo "$CE_COMMITS" | while IFS= read -r line; do
    [ -n "$line" ] && echo "- $line"
  done
else
  echo "No recent commits"
fi)

## Uncommitted Changes
$(if [ -n "$CE_UNCOMMITTED" ]; then echo "$CE_UNCOMMITTED"; else echo "All clean"; fi)

## Inbox
$(if [ -n "$CE_INBOX" ]; then echo "$CE_INBOX"; else echo "_Empty_"; fi)
EOF

echo "✅ Compile complete!"
echo "  → $DAILY_FILE"
echo "  → $VAULT/02-Projects/Flip/STATUS.md"
echo "  → $VAULT/02-Projects/Cloudeats/STATUS.md"
