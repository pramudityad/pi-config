#!/bin/bash
# Context Status - Shows all active work contexts

set -e

# Base paths
CLOUDEATS="/Users/FLP9damarpramuditya/Project/Cloudeats"
WORKTREES="/Users/FLP9damarpramuditya/Flip/repo/dpt/safaraya-service/.worktrees"

# Colors (disabled if not terminal)
if [ -t 1 ]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[0;33m'
    BLUE='\033[0;34m'
    NC='\033[0m'
else
    RED=''
    GREEN=''
    YELLOW=''
    BLUE=''
    NC=''
fi

echo "## Active Work Contexts"
echo ""

# Track modified and clean repos
declare -a MODIFIED_REPOS
declare -a CLEAN_REPOS

# Check CloudEats repos
for repo in "$CLOUDEATS"/*/; do
    if [[ -d "$repo.git" ]]; then
        repo_name=$(basename "$repo")
        branch=$(git -C "$repo" branch --show-current 2>/dev/null || echo "unknown")
        status=$(git -C "$repo" status --porcelain 2>/dev/null || echo "")
        
        if [[ -n "$status" ]]; then
            MODIFIED_REPOS+=("$repo_name|$branch|$repo")
        else
            CLEAN_REPOS+=("$repo_name|$branch")
        fi
    fi
done

# Show modified repos
if [ ${#MODIFIED_REPOS[@]} -gt 0 ]; then
    echo "### 🔥 Modified (uncommitted changes)"
    echo ""
    for entry in "${MODIFIED_REPOS[@]}"; do
        IFS='|' read -r name branch path <<< "$entry"
        echo -e "📁 **$name** [${YELLOW}$branch${NC}]"
        git -C "$path" status --short 2>/dev/null | head -5 | while read -r line; do
            echo "   $line"
        done
        local_count=$(git -C "$path" status --short 2>/dev/null | wc -l | tr -d ' ')
        if [[ $local_count -gt 5 ]]; then
            echo "   ... and $((local_count - 5)) more files"
        fi
        echo ""
    done
fi

# Show worktrees
if [[ -d "$WORKTREES" ]]; then
    echo "### 🌿 Active Worktrees"
    echo ""
    for wt in "$WORKTREES"/*/; do
        if [[ -d "$wt" ]]; then
            wt_name=$(basename "$wt")
            branch=$(git -C "$wt" branch --show-current 2>/dev/null || echo "unknown")
            last_commit=$(git -C "$wt" log -1 --oneline 2>/dev/null || echo "no commits")
            status=$(git -C "$wt" status --porcelain 2>/dev/null || echo "")
            
            status_icon="✅"
            [[ -n "$status" ]] && status_icon="🔥"
            
            echo -e "$status_icon **$wt_name** [${BLUE}$branch${NC}]"
            echo "   Last: $last_commit"
            echo ""
        fi
    done
fi

# Show clean repos
if [ ${#CLEAN_REPOS[@]} -gt 0 ]; then
    echo "### ✅ Clean Repos"
    echo ""
    for entry in "${CLEAN_REPOS[@]}"; do
        IFS='|' read -r name branch <<< "$entry"
        echo -e "✅ $name [${GREEN}$branch${NC}]"
    done
    echo ""
fi

# Quick summary
echo "---"
echo "📊 Summary: ${#MODIFIED_REPOS[@]} modified, ${#CLEAN_REPOS[@]} clean"
