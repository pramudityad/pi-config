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

## Structured output contracts

Review and consensus key off a trailing JSON block emitted by the agent, not free-form prose (`structured.ts`):

- **Consensus** voters are asked to end their reply with a ` ```json {"answer": "..."} ``` ` block; votes are compared on the `answer` field, so a verbose voter and a terse one that reach the same conclusion actually agree. Falls back to the full reply text when no block is emitted.
- **Review** reviewers end with ` ```json {"verdict": "APPROVED" | "CHANGES_REQUESTED"} ``` `; the loop keys off `verdict`. Falls back to the legacy `APPROVED`-on-its-own-line regex.

Both parsers degrade gracefully, so agents that ignore the contract still work.

## Fan-out budget guard

Before parallel / consensus / chain / review dispatch, the tool checks the **parent** context usage via `getContextUsage()`. At ≥85% of the context window it confirms (in a UI) or refuses (headless) before spawning, because each subagent's output is folded back into this context and would risk overflow. Run `/context compact` and retry.

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
model: opencode-go/kimi-k2.7-code
---
System prompt here.
```

No `skills:` field = zero skills loaded (lean).
