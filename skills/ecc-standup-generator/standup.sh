#!/bin/bash
# Standup Generator - Combines ClickUp tasks and git commits

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONFIG_FILE="$SCRIPT_DIR/config.json"
FULL_MODE=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --full|-f) FULL_MODE=true; shift ;;
        *) shift ;;
    esac
done

# Default repos if no config
REPOS=(
    "/Users/FLP9damarpramuditya/Project/Cloudeats/safaraya-service"
    "/Users/FLP9damarpramuditya/Project/Cloudeats/menu-api"
    "/Users/FLP9damarpramuditya/Project/Cloudeats/kitchen-api"
    "/Users/FLP9damarpramuditya/Project/Cloudeats/order-api"
    "/Users/FLP9damarpramuditya/Project/Cloudeats/feedback-api"
)

# Also include worktrees
WORKTREES=(
    "/Users/FLP9damarpramuditya/Flip/repo/dpt/safaraya-service"
    "/Users/FLP9damarpramuditya/Flip/repo/dpt/safaraya-service/.worktrees"
)

# Date calculations
YESTERDAY=$(date -v-1d +%Y-%m-%d 2>/dev/null || date -d "yesterday" +%Y-%m-%d)
TODAY=$(date +%Y-%m-%d)

echo "## Standup - $TODAY"
echo ""

# Git commits section
echo "### ✅ Completed Yesterday ($YESTERDAY)"
echo ""

commits_found=false

for repo_path in "${REPOS[@]}" "${WORKTREES[@]}"; do
    if [[ -d "$repo_path/.git" ]]; then
        repo_name=$(basename "$repo_path")
        commits=$(git -C "$repo_path" log --oneline --since="$YESTERDAY 00:00:00" --until="$YESTERDAY 23:59:59" --author="$(git -C "$repo_path" config user.name)" 2>/dev/null || true)
        if [[ -n "$commits" ]]; then
            commits_found=true
            count=$(echo "$commits" | wc -l | tr -d ' ')
            echo "- **[$repo_name]** ($count commits)"
            if $FULL_MODE; then
                echo "$commits" | while read -r line; do
                    echo "  - $line"
                done
            fi
        fi
    fi
done

# Check worktrees subdirectories
for wt_base in "${WORKTREES[@]}"; do
    if [[ -d "$wt_base" ]]; then
        for wt_dir in "$wt_base"/*/; do
            if [[ -d "$wt_dir.git" || -f "$wt_dir.git" ]]; then
                wt_name=$(basename "$wt_dir")
                commits=$(git -C "$wt_dir" log --oneline --since="$YESTERDAY 00:00:00" --until="$YESTERDAY 23:59:59" 2>/dev/null || true)
                if [[ -n "$commits" ]]; then
                    commits_found=true
                    count=$(echo "$commits" | wc -l | tr -d ' ')
                    echo "- **[$wt_name]** ($count commits)"
                fi
            fi
        done
    fi
done

if ! $commits_found; then
    echo "_No commits found yesterday_"
fi

echo ""

# ClickUp sections
echo "### 🔄 In Progress"
echo ""
npx @krodak/clickup-cli tasks --status "in progress" 2>/dev/null || echo "_Unable to fetch ClickUp tasks_"

echo ""
echo "### ⏰ Overdue"
echo ""
npx @krodak/clickup-cli overdue 2>/dev/null || echo "_No overdue items_"

echo ""
echo "### 📋 Sprint Summary"
echo ""
npx @krodak/clickup-cli summary 2>/dev/null || echo "_Unable to fetch summary_"
