---
name: tmux
description: Tmux-based parallel execution for independent tasks. Use when running multiple independent commands, scripts, or processes concurrently — each in its own tmux pane with isolated context. Triggers on phrases like "run in parallel", "multiple tasks at once", "parallel tmux", "tmux parallel execution".
---

# Tmux Parallel Execution

## Overview

**Core principle:** Dispatch one tmux pane per independent task. Let them run concurrently. Monitor, review, and integrate results.

When you have multiple independent tasks that can run without shared state or sequential dependencies, tmux provides lightweight isolated execution environments — one per pane — so tasks run truly in parallel.

This follows the same philosophy as `dispatching-parallel-agents`: identify independent domains, create focused tasks, execute in parallel, then review and integrate.

## When to Use

**Use when:**
- 2+ independent commands that can run simultaneously
- Running the same operation across different targets (e.g., lint 3 packages in parallel)
- Long-running processes that should not block each other
- Batch operations where each unit is independent (e.g., process 5 files concurrently)
- Development workflows needing multiple live processes (server + watcher + tests)

**Don't use when:**
- Tasks depend on each other's output (sequential dependency)
- Tasks modify the same files (shared state conflict)
- You need subagent intelligence (use `dispatching-parallel-agents` instead)
- Only 1 task to run (no parallelism needed)

## Decision Flowchart

```
Multiple tasks?
├── No → Run sequentially
└── Yes
    └── Are they independent?
        ├── No → Investigate dependencies, run sequentially
        └── Yes
            └── Do they share state (files, DB)?
                ├── Yes → Use sequential or locking
                └── No → ✅ Use tmux parallel execution
```

## The Pattern

### 1. Identify Independent Domains

Group your work into independent tasks. Each task must:
- Have a **clear scope** — one command or one focused operation
- Be **self-contained** — doesn't need output from other tasks
- Be **safe to parallelize** — won't conflict with other tasks

**Example — running tests across packages:**
```
Task 1: Run tests in packages/api
Task 2: Run tests in packages/web
Task 3: Run tests in packages/shared
```

**Example — batch file processing:**
```
Task 1: Process file-a.csv → file-a.json
Task 2: Process file-b.csv → file-b.json
Task 3: Process file-c.csv → file-c.json
```

### 2. Create Focused Task per Pane

Each pane gets a specific, bounded command. Keep tasks granular but not trivial.

```bash
# Bad: Too broad — one pane does everything
tmux send-keys -t $PANE_0 "npm test && npm run build && npm run deploy" Enter

# Good: One focused task per pane
# Capture pane IDs when creating panes (see Session Setup below)
tmux send-keys -t $PANE_0 "cd packages/api && npm test" Enter
tmux send-keys -t $PANE_1 "cd packages/web && npm test" Enter
tmux send-keys -t $PANE_2 "cd packages/shared && npm test" Enter
```

### 3. Dispatch in Parallel

Create a tmux session with one pane per task, then start all tasks.

### 4. Monitor Progress

Check each pane's output to track completion and catch errors.

### 5. Review and Integrate

When all tasks complete:
- Review each pane's output for errors
- Verify results don't conflict
- Integrate outputs into the final result

## Quick Reference

### Session Setup

```bash
# Create a parallel session (detached), capture pane ID
PANE_0=$(tmux new-session -d -s parallel -P -F '#{pane_id}')

# Create additional panes, capture each pane ID
PANE_1=$(tmux split-window -h -t "$PANE_0" -P -F '#{pane_id}')  # horizontal split
PANE_2=$(tmux split-window -v -t "$PANE_0" -P -F '#{pane_id}')  # vertical split

# Now use $PANE_0, $PANE_1, $PANE_2 for all commands (index-safe)
```

### Sending Commands

```bash
# Send command to a specific pane (use pane ID, not index)
tmux send-keys -t "$PANE_0" "<command>" Enter

# Send to all panes in a window (synchronize)
tmux setw -t parallel synchronize-panes on
tmux send-keys -t parallel "<command>" Enter
tmux setw -t parallel synchronize-panes off
```

### Monitoring

```bash
# Capture output from a pane (use pane ID)
tmux capture-pane -t "$PANE_0" -p -S -50

# Or list all pane IDs and commands
tmux list-panes -t parallel -F "#{pane_id}: #{pane_current_command}"

# Watch all panes (attach to session)
tmux attach -t parallel
```

### Cleanup

```bash
# Kill entire session when done
tmux kill-session -t parallel

# Kill specific pane
tmux kill-pane -t parallel:0.1
```

## Helper Script: `parallel.sh`

Use the helper script to set up a parallel execution session:

```bash
# From skill directory
./scripts/parallel.sh <session-name> <working-dir> <command1> "<command2>" ...
```

Example:
```bash
./scripts/parallel.sh testing ~/myproject \
  "cd packages/api && npm test" \
  "cd packages/web && npm test" \
  "cd packages/shared && npm test"
```

## Common Patterns

### Pattern 1: Parallel Test Runner

Run tests across multiple packages simultaneously:

```bash
P0=$(tmux new-session -d -s tests -c ~/project -P -F '#{pane_id}')
P1=$(tmux split-window -h -t "$P0" -c ~/project/packages/api -P -F '#{pane_id}')
P2=$(tmux split-window -v -t "$P0" -c ~/project/packages/web -P -F '#{pane_id}')
tmux send-keys -t "$P0" "cd ~/project/packages/shared && npm test" Enter
tmux send-keys -t "$P1" "npm test" Enter
tmux send-keys -t "$P2" "npm test" Enter
# Monitor: tmux attach -t tests
```

### Pattern 2: Parallel Build

Build multiple targets at once:

```bash
P0=$(tmux new-session -d -s build -c ~/project -P -F '#{pane_id}')
P1=$(tmux split-window -h -t "$P0" -c ~/project -P -F '#{pane_id}')
P2=$(tmux split-window -v -t "$P0" -c ~/project -P -F '#{pane_id}')
tmux send-keys -t "$P0" "npm run build:api" Enter
tmux send-keys -t "$P1" "npm run build:web" Enter
tmux send-keys -t "$P2" "npm run build:docs" Enter
```

### Pattern 3: Dev Environment

Spin up a full dev environment with multiple live processes:

```bash
tmux new-session -d -s dev -c ~/project
tmux rename-window -t dev:0 'main'
tmux split-window -v -p 30 -t dev:main -c ~/project
tmux new-window -t dev -n 'server' -c ~/project
tmux new-window -t dev -n 'watcher' -c ~/project
tmux send-keys -t dev:server 'npm run dev' Enter
tmux send-keys -t dev:watcher 'npm run watch' Enter
tmux send-keys -t dev:main 'vim' Enter
tmux attach -t dev
```

### Pattern 4: Parallel File Processing

Process multiple files concurrently:

```bash
P0=$(tmux new-session -d -s process -c ~/data -P -F '#{pane_id}')
P1=$(tmux split-window -h -t "$P0" -c ~/data -P -F '#{pane_id}')
P2=$(tmux split-window -v -t "$P0" -c ~/data -P -F '#{pane_id}')
tmux send-keys -t "$P0" "./transform.sh input/a.csv output/a.json" Enter
tmux send-keys -t "$P1" "./transform.sh input/b.csv output/b.json" Enter
tmux send-keys -t "$P2" "./transform.sh input/c.csv output/c.json" Enter
```

### Pattern 5: Parallel Git Operations

Run git operations across multiple repos:

```bash
P0=$(tmux new-session -d -s gitops -c ~/repos/api -P -F '#{pane_id}')
P1=$(tmux split-window -h -t "$P0" -c ~/repos/web -P -F '#{pane_id}')
tmux setw -t gitops synchronize-panes on
tmux send-keys -t gitops "git pull origin main" Enter
tmux setw -t gitops synchronize-panes off
```

## Monitoring & Status Checking

### Check completion status of all panes

```bash
# List panes with their IDs and commands (shell = likely done)
tmux list-panes -t parallel -F "#{pane_id}: #{pane_current_command}"

# Capture last 20 lines from each pane (using pane IDs)
for pane_id in $(tmux list-panes -t parallel -F "#{pane_id}"); do
  echo "=== Pane $pane_id ==="
  tmux capture-pane -t "$pane_id" -p -S -20
  echo ""
done
```

### Wait for all panes to complete

```bash
# Poll until all panes return to shell (adjust shell names for your system)
while true; do
  running=$(tmux list-panes -t parallel -F "#{pane_current_command}" | grep -cvE "zsh|bash|fish|sh$")
  if [ "$running" -eq 0 ]; then
    echo "All tasks complete!"
    break
  fi
  echo "Waiting... $running tasks still running"
  sleep 2
done
```

## Integration with Other Skills

| Scenario | Combine with |
|----------|-------------|
| Intelligent parallel tasks (need AI per task) | `dispatching-parallel-agents` |
| Executing a plan with parallel tasks | `subagent-development` or `executing-plans` |
| Debugging parallel task failures | `systematic-debugging` |
| Verifying parallel results | `verification-before-completion` |

**When to use tmux vs subagents:**
- **Tmux:** Simple commands, scripts, builds, tests, file processing — tasks that are deterministic
- **Subagents:** Need AI reasoning, code generation, debugging — tasks requiring intelligence

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Too many panes (hard to read) | Max 4-6 panes per window. Use multiple windows for more tasks. |
| Tasks editing same files | Ensure each task operates on independent files/resources. |
| Not checking exit codes | Use `echo $?` after each command or check `pane_current_command`. |
| Forgetting to kill session | Always `tmux kill-session -t <name>` when done to clean up. |
| Creating session inside session | Use `-d` (detached) when scripting, attach only to monitor. |
| Pane index mismatch (`0.0` vs `1.1`) | Use `-P -F '#{pane_id}'` to capture unique pane IDs instead of relying on indices. `base-index` may be 0 or 1. |
| Panes too small to read | Use even layouts: `tmux select-layout -t parallel even-horizontal` or `even-vertical`. |

## Layout Helpers

```bash
# Even horizontal split (side by side)
tmux select-layout -t parallel even-horizontal

# Even vertical split (stacked)
tmux select-layout -t parallel even-vertical

# Tiled layout (grid)
tmux select-layout -t parallel tiled

# Main-horizontal (large top, small bottom panes)
tmux select-layout -t parallel main-horizontal
```
