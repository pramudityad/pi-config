#!/bin/bash
# Quick context switch - Find and navigate to repos/worktrees

set -e

CLOUDEATS="/Users/FLP9damarpramuditya/Project/Cloudeats"
WORKTREES="/Users/FLP9damarpramuditya/Flip/repo/dpt/safaraya-service/.worktrees"

list_contexts() {
    echo "Available contexts:"
    echo ""
    echo "Repos:"
    for repo in "$CLOUDEATS"/*/; do
        if [[ -d "$repo.git" ]]; then
            name=$(basename "$repo")
            branch=$(git -C "$repo" branch --show-current 2>/dev/null || echo "?")
            echo "  $name [$branch]"
        fi
    done
    echo ""
    echo "Worktrees:"
    for wt in "$WORKTREES"/*/; do
        if [[ -d "$wt" ]]; then
            name=$(basename "$wt")
            branch=$(git -C "$wt" branch --show-current 2>/dev/null || echo "?")
            echo "  $name [$branch]"
        fi
    done
}

find_by_ticket() {
    local ticket="$1"
    
    # Search repos
    for repo in "$CLOUDEATS"/*/; do
        if [[ -d "$repo.git" ]]; then
            branch=$(git -C "$repo" branch --show-current 2>/dev/null || echo "")
            if [[ "$branch" == *"$ticket"* ]]; then
                echo "repo:$(basename "$repo"):$repo"
                return 0
            fi
            # Check all branches
            if git -C "$repo" branch -a 2>/dev/null | grep -q "$ticket"; then
                echo "repo:$(basename "$repo"):$repo (has matching branch)"
            fi
        fi
    done
    
    # Search worktrees
    for wt in "$WORKTREES"/*/; do
        if [[ -d "$wt" ]]; then
            name=$(basename "$wt")
            if [[ "$name" == *"$ticket"* ]]; then
                echo "worktree:$name:$wt"
                return 0
            fi
            branch=$(git -C "$wt" branch --show-current 2>/dev/null || echo "")
            if [[ "$branch" == *"$ticket"* ]]; then
                echo "worktree:$name:$wt"
                return 0
            fi
        fi
    done
    
    return 1
}

# Main
if [[ "$1" == "--list" || "$1" == "-l" ]]; then
    list_contexts
    exit 0
fi

if [[ -z "$1" ]]; then
    list_contexts
    echo ""
    echo "Usage: switch.sh <ticket|repo-name>"
    exit 0
fi

query="$1"

# Try exact repo match first
for repo in "$CLOUDEATS"/*/; do
    if [[ -d "$repo.git" ]]; then
        name=$(basename "$repo")
        if [[ "$name" == "$query" ]]; then
            echo "$repo"
            exit 0
        fi
    fi
done

# Try worktree match
for wt in "$WORKTREES"/*/; do
    if [[ -d "$wt" ]]; then
        name=$(basename "$wt")
        if [[ "$name" == "$query" ]]; then
            echo "$wt"
            exit 0
        fi
    fi
done

# Search by ticket
result=$(find_by_ticket "$query" | head -1)
if [[ -n "$result" ]]; then
    IFS=':' read -r type name path <<< "$result"
    echo "$path"
    exit 0
fi

echo "No context found for: $query" >&2
exit 1
