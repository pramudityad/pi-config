#!/bin/bash
# status.sh — Quick "where was I" (terminal only, no files written)
set -euo pipefail

FLIP_REPOS="/Users/FLP9damarpramuditya/Flip/repo"
CE_REPOS="/Users/FLP9damarpramuditya/Project/Cloudeats"

echo ""
echo "═══════════════════════════════════════"
echo "  🧭 WHERE WAS I — $(date +%a\ %Y-%m-%d\ %H:%M)"
echo "═══════════════════════════════════════"

# ─── CloudEats ───
echo ""
echo "🟦 CLOUDEATS"
echo "─────────────"

# Find most recent commit across all repos
latest_date=""
latest_msg=""
latest_repo=""

for repo in "$CE_REPOS"/*/; do
  if [ -d "$repo/.git" ]; then
    repo_name=$(basename "$repo")
    
    # Last commit
    last=$(git -C "$repo" log -1 --format="%ad|%s" --date=short 2>/dev/null || true)
    if [ -n "$last" ]; then
      date_part=$(echo "$last" | cut -d'|' -f1)
      msg_part=$(echo "$last" | cut -d'|' -f2)
      
      if [ -z "$latest_date" ] || [[ "$date_part" > "$latest_date" ]]; then
        latest_date="$date_part"
        latest_msg="$msg_part"
        latest_repo="$repo_name"
      fi
    fi
    
    # Active branch
    branch=$(git -C "$repo" branch --show-current 2>/dev/null || true)
    if [ -n "$branch" ] && [ "$branch" != "master" ] && [ "$branch" != "main" ] && [ "$branch" != "dev" ] && [ "$branch" != "staging" ]; then
      echo "  🔀 ${repo_name}: ${branch}"
    fi
  fi
done

if [ -n "$latest_repo" ]; then
  echo "  📌 Last commit: ${latest_date} — ${latest_repo} — ${latest_msg}"
fi

# Jira
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/format-jira.sh"
if command -v jiracli &>/dev/null && [ -f ~/.jiracli/config.json ]; then
  echo "  📋 Jira:"
  CE_TASKS_RAW=$(jiracli list --status "In Progress" 2>/dev/null || echo "")
  if [ -n "$CE_TASKS_RAW" ]; then
    format_jira_table "$CE_TASKS_RAW" | while IFS= read -r line; do
      echo "     $line"
    done
  else
    echo "     _no tasks in progress_"
  fi
else
  echo "  📋 Jira: _jiracli not configured — run jiracli config_"
fi

# ─── Flip ───
echo ""
echo "🟧 FLIP"
echo "───────"

FLIP_LATEST_DATE=""
FLIP_LATEST_MSG=""
FLIP_LATEST_REPO=""

while IFS= read -r gitdir; do
  repo=$(dirname "$gitdir")
  repo_name=$(echo "$repo" | sed "s|${FLIP_REPOS}/||")
  
  # Last commit
  last=$(git -C "$repo" log -1 --format="%ad|%s" --date=short 2>/dev/null || true)
  if [ -n "$last" ]; then
    date_part=$(echo "$last" | cut -d'|' -f1)
    msg_part=$(echo "$last" | cut -d'|' -f2)
    if [ -z "$FLIP_LATEST_DATE" ] || [[ "$date_part" > "$FLIP_LATEST_DATE" ]]; then
      FLIP_LATEST_DATE="$date_part"
      FLIP_LATEST_MSG="$msg_part"
      FLIP_LATEST_REPO="$repo_name"
    fi
  fi
  
  # Active branches
  branch=$(git -C "$repo" branch --show-current 2>/dev/null || true)
  if [ -n "$branch" ] && [ "$branch" != "master" ] && [ "$branch" != "main" ] && [ "$branch" != "dev" ] && [ "$branch" != "staging" ] && [ "$branch" != "v2" ]; then
    echo "  🔀 ${repo_name}: ${branch}"
  fi
done < <(find "$FLIP_REPOS" -maxdepth 3 -name ".git" -type d 2>/dev/null)

if [ -n "$FLIP_LATEST_REPO" ]; then
  echo "  📌 Last commit: ${FLIP_LATEST_DATE} — ${FLIP_LATEST_REPO} — ${FLIP_LATEST_MSG}"
fi

# ClickUp
if command -v clickup &>/dev/null; then
  echo "  📋 ClickUp:"
  clickup tasks --filter "status=in progress" 2>/dev/null | head -5 | while IFS= read -r line; do
    echo "     $line"
  done || true
else
  echo "  📋 ClickUp: _clickup not configured_"
fi

# ─── Inbox ───
VAULT="/Users/FLP9damarpramuditya/Documents/Obsidian Vault"
INBOX="$VAULT/INBOX.md"
if [ -f "$INBOX" ]; then
  count=$(grep -c "^\- \[ \]" "$INBOX" 2>/dev/null || true)
  count=${count:-0}
  if [ "$count" -gt 0 ]; then
    echo ""
    echo "📥 INBOX: ${count} unprocessed items"
    grep "^\- \[ \]" "$INBOX" | head -5 | while IFS= read -r line; do
      echo "  $line"
    done
  fi
fi

echo ""
echo "═══════════════════════════════════════"
echo ""
