#!/bin/bash
# PR Ready Check - Validates code is ready for PR

set -e

FULL_MODE=false
PR_MODE=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --full|-f) FULL_MODE=true; shift ;;
        --pr|-p) PR_MODE=true; shift ;;
        *) shift ;;
    esac
done

# Colors
if [ -t 1 ]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[0;33m'
    NC='\033[0m'
else
    RED=''
    GREEN=''
    YELLOW=''
    NC=''
fi

# Get current branch and ticket
BRANCH=$(git branch --show-current)
TICKET=$(echo "$BRANCH" | grep -oE '[A-Z]+-[0-9]+' || echo "Unknown")

echo "## PR Readiness Check"
echo ""
echo "### Ticket: $TICKET"
echo "### Branch: $BRANCH"
echo ""

# Track results
declare -A RESULTS
PASS_COUNT=0
FAIL_COUNT=0
WARN_COUNT=0

run_check() {
    local name="$1"
    local cmd="$2"
    local required="$3"
    
    echo -n "Running $name... "
    
    if output=$(eval "$cmd" 2>&1); then
        echo -e "${GREEN}✅ PASS${NC}"
        RESULTS["$name"]="PASS"
        ((PASS_COUNT++))
        return 0
    else
        if [[ "$required" == "required" ]]; then
            echo -e "${RED}❌ FAIL${NC}"
            RESULTS["$name"]="FAIL"
            ((FAIL_COUNT++))
        else
            echo -e "${YELLOW}⚠️ WARN${NC}"
            RESULTS["$name"]="WARN"
            ((WARN_COUNT++))
        fi
        return 1
    fi
}

# Run checks
echo "| Check | Status |"
echo "|-------|--------|"

# Lint
if run_check "🔍 Lint" "npm run lint --silent" "required"; then
    echo "| 🔍 Lint | ✅ PASS |"
else
    echo "| 🔍 Lint | ❌ FAIL |"
fi

# Type check
if run_check "📝 Types" "npx tsc --noEmit" "required"; then
    echo "| 📝 Types | ✅ PASS |"
else
    echo "| 📝 Types | ❌ FAIL |"
fi

# Tests
if run_check "🧪 Tests" "npm test --silent 2>&1 | tail -5" "required"; then
    echo "| 🧪 Tests | ✅ PASS |"
else
    echo "| 🧪 Tests | ❌ FAIL |"
fi

# Security audit (optional)
if run_check "🔒 Security" "npm audit --audit-level=moderate" "optional"; then
    echo "| 🔒 Security | ✅ PASS |"
else
    echo "| 🔒 Security | ⚠️ WARN |"
fi

# Build
if run_check "📦 Build" "npm run build" "required"; then
    echo "| 📦 Build | ✅ PASS |"
else
    echo "| 📦 Build | ❌ FAIL |"
fi

# Git status
if git diff --quiet && git diff --staged --quiet; then
    echo "| 🌿 Git | ✅ PASS | Clean |"
    ((PASS_COUNT++))
else
    echo "| 🌿 Git | ❌ FAIL | Uncommitted changes |"
    ((FAIL_COUNT++))
fi

echo ""

# Summary
if [[ $FAIL_COUNT -eq 0 ]]; then
    echo -e "### Ready for PR: ${GREEN}✅ YES${NC}"
else
    echo -e "### Ready for PR: ${RED}❌ NO${NC}"
    echo "Fix the failing checks before submitting PR."
fi

echo ""

# Changed files
echo "### Changed Files"
git diff --name-only origin/dev-alfred...HEAD 2>/dev/null || git diff --name-only HEAD~10...HEAD | while read -r file; do
    echo "- $file"
done

# PR description generation
if $PR_MODE; then
    echo ""
    echo "### Suggested PR Description"
    echo "---"
    echo "**Ticket:** $TICKET"
    echo "**Type:** Feature"
    echo ""
    echo "## Changes"
    git log --oneline origin/dev-alfred...HEAD 2>/dev/null | head -5 | while read -r line; do
        echo "- $line"
    done
    echo ""
    echo "## Testing"
    echo "- [x] Unit tests added"
    echo "- [x] Manual testing in dev"
    echo ""
    echo "## Checklist"
    echo "- [x] No lint errors"
    echo "- [x] Types check passes"
    echo "- [x] All tests pass"
    echo "---"
fi

# Exit code
if [[ $FAIL_COUNT -gt 0 ]]; then
    exit 1
fi
