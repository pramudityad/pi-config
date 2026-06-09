# Subagent Extension

SDK-based subagent orchestrator. In-process nested sessions (not CLI spawn).

## Modes

| Mode | Params | Description |
|------|--------|-------------|
| Single | `{ agent, task }` | One agent, one task |
| Parallel | `{ tasks: [...] }` | Multiple agents concurrently (max 8, 4 concurrent) |
| Chain | `{ chain: [...] }` | Sequential with `{previous}` placeholder; sessions warm |
| Review | `{ review: { implementer, reviewer, task, maxIterations } }` | Impl↔review loop until APPROVED |
| Consensus | `{ consensus: { agent, task, voters } }` | N runs, majority wins |

## Shared scratchpad

Enable with `scratchpad: true` on any mode. Agents read/write `.pi/scratch/<id>.md` for cross-agent coordination.

## Agent definitions

`.md` files in `~/.pi/agent/agents/` with YAML frontmatter:

```markdown
---
name: my-agent
description: What this does
tools: read, grep, ls
skills: pgcli, ecc-backend-patterns  # optional: scopes which skills load
model: anthropic/claude-opus-4-8
---
System prompt here.
```

No `skills:` field = zero skills loaded (lean).
