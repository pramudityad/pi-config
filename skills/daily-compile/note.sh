#!/bin/bash
# note.sh — Quick capture to INBOX.md
# Usage: note.sh [CE|FL:] message
set -euo pipefail

VAULT="/Users/FLP9damarpramuditya/Documents/Obsidian Vault"
INBOX="$VAULT/INBOX.md"
TODAY=$(date +%b\ %e)

# Parse company from first arg or auto-detect
COMPANY=""
MESSAGE=""

if [ $# -eq 0 ]; then
  echo "Usage: note.sh [CE|FL:] message"
  exit 1
fi

ALL_ARGS="$*"

# Check if message starts with company prefix
case "$ALL_ARGS" in
  CE:\ *)
    COMPANY="ce"
    MESSAGE="${ALL_ARGS#CE: }"
    ;;
  FL:\ *)
    COMPANY="flip"
    MESSAGE="${ALL_ARGS#FL: }"
    ;;
  *)
    # Auto-detect from cwd
    CWD=$(pwd)
    if [[ "$CWD" == *"/Cloudeats/"* ]] || [[ "$CWD" == *"/cloudeats/"* ]]; then
      COMPANY="ce"
    elif [[ "$CWD" == *"/Flip/"* ]] || [[ "$CWD" == *"/flip/"* ]]; then
      COMPANY="flip"
    else
      COMPANY="ce"  # default
    fi
    MESSAGE="$ALL_ARGS"
    ;;
esac

# Create INBOX.md if it doesn't exist
if [ ! -f "$INBOX" ]; then
  cat > "$INBOX" << 'HEADER'
---
type: inbox
---

# 📥 Inbox
_Unprocessed items — `pi compile` surfaces stale ones_

## CloudEats #ce

## Flip #flip
HEADER
fi

# Ensure the section exists and append
if [ "$COMPANY" = "ce" ]; then
  if ! grep -q "^## CloudEats #ce" "$INBOX" 2>/dev/null; then
    echo "" >> "$INBOX"
    echo "## CloudEats #ce" >> "$INBOX"
  fi
  # Use awk to insert after first occurrence of the section header
  awk -v msg="- [ ] ${MESSAGE} — _${TODAY}_" '
    /^## CloudEats #ce/ && !inserted { print; print msg; inserted=1; next }
    { print }
  ' "$INBOX" > "${INBOX}.tmp" && mv "${INBOX}.tmp" "$INBOX"
else
  if ! grep -q "^## Flip #flip" "$INBOX" 2>/dev/null; then
    echo "" >> "$INBOX"
    echo "## Flip #flip" >> "$INBOX"
  fi
  awk -v msg="- [ ] ${MESSAGE} — _${TODAY}_" '
    /^## Flip #flip/ && !inserted { print; print msg; inserted=1; next }
    { print }
  ' "$INBOX" > "${INBOX}.tmp" && mv "${INBOX}.tmp" "$INBOX"
fi

COMPANY_UPPER=$(echo "$COMPANY" | tr '[:lower:]' '[:upper:]')
echo "✅ Added to ${COMPANY_UPPER} inbox: ${MESSAGE}"
