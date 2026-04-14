#!/bin/bash
# format-jira.sh — Parses raw jiracli output into markdown table
# Usage: sourced by compile.sh and status.sh
# Call: format_jira_table "$raw_output"

format_jira_table() {
  local raw="$1"
  
  [ -z "$raw" ] && return
  
  echo "| Ticket | Priority | Title |"
  echo "|--------|----------|-------|"
  
  # Use "V2-" to match ticket lines (avoids emoji encoding issues)
  local tickets
  tickets=$(echo "$raw" | grep "V2-")
  
  while IFS= read -r line; do
    [ -z "$line" ] && continue
    
    ticket=$(echo "$line" | awk '{print $1}')
    # Verify it looks like a ticket key (simple grep for macOS compat)
    echo "$ticket" | grep -q "V2-[0-9]" || continue
    
    priority=$(echo "$line" | awk '{
      for(i=1;i<=NF;i++) {
        if($i=="High" || $i=="Medium" || $i=="Low" || $i=="Highest" || $i=="Lowest" || $i=="Critical" || $i=="Blocker") {
          print $i; break
        }
      }
    }')
    priority=${priority:-"None"}
    
    # Title: everything after last "] "
    title=$(echo "$line" | rev | cut -d']' -f1 | rev | sed 's/^[[:space:]]*//')
    
    case "$priority" in
      Highest|Critical|Blocker) emoji="🔴" ;;
      High) emoji="🔴" ;;
      Medium) emoji="🟡" ;;
      Low|Lowest) emoji="🟢" ;;
      *) emoji="⚪" ;;
    esac
    
    if [ -n "$ticket" ] && [ -n "$title" ]; then
      echo "| ${ticket} | ${emoji} ${priority} | ${title} |"
    fi
  done <<< "$tickets"
}
