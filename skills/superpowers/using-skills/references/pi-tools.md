# Pi Tool Equivalents

This document maps Superpowers tool references to Pi equivalents.

## Skill Loading

| Platform | Mechanism |
|----------|-----------|
| **Pi** | `/skill:name` command or auto-load via description match in system prompt |
| **Claude Code** | `Skill` tool |
| **Codex CLI** | `skill` tool |
| **Gemini CLI** | `activate_skill` tool |
| **Copilot CLI** | `skill` tool (auto-discovered from plugins) |

## Subagents

| Platform | Mechanism |
|----------|-----------|
| **Pi** | `subagent` tool with `agent` name, `task` description, and `agentScope` |
| **Claude Code** | `Task` tool with subagent_type |
| **Codex CLI** | `Task` tool with subagent_type |
| **Gemini CLI** | Sub-agent delegation via `run_subagent` |
| **Copilot CLI** | `task` tool |

## Task Tracking

| Platform | Mechanism |
|----------|-----------|
| **Pi** | Checkbox markdown (`- [ ]`) in plan documents |
| **Claude Code** | `TodoWrite` tool |
| **Codex CLI** | `TodoWrite` tool |
| **Gemini CLI** | `todo_write` tool |
| **Copilot CLI** | `todo` tool |

## Code Review

| Platform | Mechanism |
|----------|-----------|
| **Pi** | `subagent` tool with reviewer agent |
| **Claude Code** | `Task` tool with reviewer subagent |
| **Codex CLI** | `Task` tool with reviewer subagent |

## Graph Rendering

| Platform | Mechanism |
|----------|-----------|
| **Pi** | `render_graph` tool (native, supports Mermaid DSL) |
| **Claude Code** | `render-graphs.js` script (Graphviz DOT) |
| **Other** | Manual rendering via external tools |

## File Operations

| Platform | Mechanism |
|----------|-----------|
| **Pi** | `read`, `edit`, `write`, `bash` tools |
| **Claude Code** | `Read`, `Write`, `Edit`, `Bash` tools |
| **Codex CLI** | `read`, `write`, `edit`, `bash` tools |
| **Gemini CLI** | `read_file`, `write_file`, `edit_file`, `run_command` tools |
| **Copilot CLI** | `read`, `write`, `edit`, `run` tools |

## Worktree / Workspace Isolation

| Platform | Mechanism |
|----------|-----------|
| **Pi** | `git-worktrees` skill (git worktree fallback) |
| **Claude Code** | `EnterWorktree` tool or git worktree fallback |
| **Codex CLI** | Native worktree support or git fallback |
| **Gemini CLI** | `enter_worktree` tool or git fallback |

## Plan Mode / Spec Writing

| Platform | Mechanism |
|----------|-----------|
| **Pi** | `brainstorming` skill → `writing-plans` skill |
| **Claude Code** | `EnterPlanMode` or `brainstorming` skill |
| **Codex CLI** | Plan mode or `brainstorming` skill |
| **Gemini CLI** | `enter_plan_mode` or `brainstorming` skill |
