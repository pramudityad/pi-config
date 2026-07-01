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

## Durable run state & resume

Every multi-step run persists a compact record to `.pi/runs/<id>.json` (on by default; disable with `persist: false`). Only per-step final text, status, and usage are stored — not full transcripts — so files stay small.

- **Chain resume:** if a chain fails mid-way, the result reports its `runId`. Re-invoke with the **same `chain` and `runId`** to skip already-completed leading steps and resume from the first incomplete one. `{previous}` is restored from the persisted step output. A fingerprint guards against resuming a chain that has since been edited (mismatch → refuses, asks you to start fresh).
- **Parallel / review / consensus:** persisted as a completed/failed audit record at the end of the run.

```
subagent({ chain: [ {agent:"scout", task:"recon"}, {agent:"worker", task:"build {previous}"} ] })
// → step 2 fails, reports runId "abc-123"
subagent({ chain: [ {agent:"scout", task:"recon"}, {agent:"worker", task:"build {previous}"} ], runId: "abc-123" })
// → step 1 reused from state, resumes at step 2
```

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
