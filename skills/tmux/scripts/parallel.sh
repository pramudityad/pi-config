#!/bin/bash
# parallel.sh — Create a tmux session with one pane per command, run them in parallel
set -euo pipefail

SESSION_NAME="${1:?Usage: parallel.sh <session-name> <working-dir> <cmd1> [\"<cmd2>\" ...]}"
WORK_DIR="${2:?Working directory required}"
shift 2
COMMANDS=("$@")

if [ ${#COMMANDS[@]} -eq 0 ]; then
  echo "Error: At least one command required"
  exit 1
fi

# Kill existing session if it exists
tmux kill-session -t "$SESSION_NAME" 2>/dev/null || true

# Create session with first command
FIRST_PANE=$(tmux new-session -d -s "$SESSION_NAME" -c "$WORK_DIR" -P -F '#{pane_id}')
tmux send-keys -t "$FIRST_PANE" "${COMMANDS[0]}" Enter

# Create additional panes for remaining commands
PANE_INDEX=1
for i in "${COMMANDS[@]:1}"; do
  NEW_PANE=$(tmux split-window -t "$SESSION_NAME" -c "$WORK_DIR" -P -F '#{pane_id}')
  tmux send-keys -t "$NEW_PANE" "$i" Enter
  PANE_INDEX=$((PANE_INDEX + 1))
done

# Even out the layout
tmux select-layout -t "$SESSION_NAME" tiled

echo "Session '$SESSION_NAME' created with ${#COMMANDS[@]} parallel panes."
echo "Monitor:  tmux attach -t $SESSION_NAME"
echo "Cleanup:  tmux kill-session -t $SESSION_NAME"

# Show status
tmux list-panes -t "$SESSION_NAME" -F "  Pane #{pane_index}: #{pane_current_command}"
