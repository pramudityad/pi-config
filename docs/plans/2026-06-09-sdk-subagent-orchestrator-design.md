# SDK-Based Subagent Orchestrator — Design

**Date:** 2026-06-09
**Status:** Approved (pending spec review)
**Author:** brainstorming session

## Summary

Replace the current CLI-spawn `subagent` tool with an in-process orchestrator
built on the pi SDK (`createAgentSession()`). The spawn-and-die approach kills
each subagent process after one call, which makes warm context, review loops,
and cross-agent coordination impossible. Running sessions in-process unlocks all
of these as orchestration logic on top of a single foundation.

This is **one coherent system**, not five separate features. The SDK foundation
enables the other four capabilities almost for free:

```
        ┌─────────────────────────────────────────┐
        │   In-process SDK orchestrator (the base) │
        │   createAgentSession(), not CLI spawn    │
        └─────────────────────────────────────────┘
                          │ unlocks
        ┌─────────────────┼─────────────────┐
        ▼                 ▼                 ▼
   Custom tools/      Warm context      Bidirectional
   skill scoping      across tasks      review loops
                          │
                          ▼
                    Consensus voting
```

## Goals

1. Subagents that can coordinate (review loops + shared scratchpad).
2. Per-subagent skill scoping (lean, focused agent contexts).
3. Warm context reuse within a single workflow.
4. Parallel consensus/voting with majority resolution.
5. In-process SDK sessions replacing CLI spawn.

## Non-Goals (YAGNI)

- Full-mesh agent-to-agent messaging (review loops + scratchpad cover the real need).
- Programmatic `defineTool` custom tools (skills-via-bash is sufficient today).
- Adjudicator agent for consensus ties (majority + flag is enough for factual questions).
- Persistent cross-workflow warm sessions (warm is scoped to one workflow run).

## Architecture

```
┌────────────────────────────────────────────────────────────┐
│                   Main PI Session                            │
│  LLM calls subagent tool ──→ orchestrator.execute()          │
│       ┌────────────────────────────┬──────────────────┐     │
│       ▼                            ▼                  ▼     │
│  AgentSession A             AgentSession B      AgentSession C│
│  (scout)                    (worker)            (reviewer)   │
│  • own context              • own context       • own context│
│  • scoped skills            • warm across tasks • scoped     │
│       │                            │ ◄──── review loop ──────┤
│       └──── writes ──→  .pi/scratch/<id>.md  ◄── reads ──────┘
│                         (shared scratchpad)                  │
└────────────────────────────────────────────────────────────┘
```

- Sessions live in the orchestrator's memory for the duration of a single tool
  call (one workflow). Disposed when the workflow ends.
- Each subagent is a `createAgentSession()` with its own model, tools, scoped
  skills, and system prompt (from the agent `.md` file).
- Reused unchanged: the 11 agent `.md` files, TUI rendering (collapsed/expanded,
  usage stats), abort handling.

## Tool Interface

The `subagent` tool keeps its 3 existing modes and adds 2 new ones:

| Mode | Params | Notes |
|------|--------|-------|
| `single` | `{ agent, task }` | unchanged |
| `parallel` | `{ tasks: [...] }` | unchanged |
| `chain` | `{ chain: [...] }` | now **warm** — sessions persist across steps |
| `review` 🆕 | `{ implementer, reviewer, task, maxIterations }` | impl ↔ review loop until pass |
| `consensus` 🆕 | `{ agent, task, voters }` | N runs, majority wins, ties flagged |

All modes accept optional `scratchpad: true` to enable the shared file, and
`keepScratch: true` to preserve it after the run for debugging.

## Mechanisms

### Skill scoping

Add optional `skills:` field to agent frontmatter. Orchestrator loads only those
skills into the subagent's context via a `ResourceLoader` override.

```markdown
---
name: ecc-database-reviewer
tools: read, grep, find, ls, bash
skills: pgcli, ecc-backend-patterns
model: github-copilot/gpt-5.3-codex
---
```

- **No `skills:` field → agent gets NO skills** (explicit > implicit, keeps
  context minimal).
- Skill names resolve against installed skills (`~/.pi/agent/skills/`).

### Warm context lifecycle

- Within a `chain` or `review` workflow, each agent keeps **one** session alive
  across steps, keyed by agent name.
- Warm only within a single workflow run; separate tool calls = fresh sessions.
- Workflow ends → all sessions disposed.

Example:

```
/implement "add caching"
  step 1: scout    → fresh session, explores
  step 2: planner  → fresh session, plans
  step 3: worker   → session created, implements task A
          worker   → SAME session, task B (remembers A)  ← warm
```

### Shared scratchpad

- Path: `.pi/scratch/<workflow-id>.md`, created at workflow start.
- Each subagent's task prompt is appended: "Shared notes for this workflow:
  `<path>`. Read it for context from other agents; append your findings."
- Agents use existing `read`/`write` tools — no new tooling.
- Cleaned up after the run unless `keepScratch: true`.

### Consensus resolution

```
consensus({ agent: "scout", task: "count User interfaces", voters: 3 })
  → runs scout 3× in parallel (isolated sessions)
  → normalizes + compares final answers
  → 3 agree    → return answer ✓
  → 2 agree    → return majority, note the dissenter
  → all differ → flag tie, show all answers side-by-side ⚠
```

## Migration of Existing Workflows

Slash commands stay identical; they become thin wrappers over the new modes.

| Command | Before | After |
|---------|--------|-------|
| `/implement` | chain scout→planner→worker | chain (warm worker) + scratchpad |
| `/implement-and-review` | chain worker→reviewer→worker | **review mode** (real loop) |
| `/scout-and-plan` | chain scout→planner | chain + scratchpad |
| `/init-agents-md` | chain scout→worker | chain (warm) + scratchpad |

`/implement-and-review` upgrades from a fixed 3-step chain to a proper review
loop with `maxIterations`.

## Feasibility Findings

From audit of the installed pi (`@earendil-works/pi-coding-agent`):

1. ✅ `createAgentSession`, `SessionManager`, `DefaultResourceLoader` are
   exported and importable.
2. ⚠️ The current installed `subagent` extension imports the stale
   `@mariozechner/pi-coding-agent` scope (renamed to `@earendil-works`). It may
   be silently broken on the current pi version — another reason "replace" is
   correct. New code must use `@earendil-works/*` imports.

### Risk to spike first

**Unknown:** Can `createAgentSession()` be called inside a running extension's
`execute()` to spawn nested in-process sessions without event-bus/cwd conflicts
or recursion issues?

**Mitigation:** First implementation step is a ~20-line spike that creates one
nested session and runs one prompt. If it works, the design is green. If not,
fall back to a hybrid: spawn a small SDK-based Node script per workflow (keeps
SDK benefits, loses pure in-process warm sharing).

## Testing Approach

- **Spike** first: nested session creation works.
- **Unit:** agent discovery with `skills:` field; consensus vote resolution;
  scratchpad lifecycle (create/append/cleanup).
- **Integration:** each mode end-to-end (single/parallel/chain/review/consensus)
  with a cheap model.
- **Migration:** all 4 slash commands produce equivalent or better results.

## Open Questions

None blocking. The nested-session spike resolves the only real unknown.

## Decisions Log

| Decision | Choice |
|----------|--------|
| Replace vs. alongside | **Replace** existing CLI-spawn tool |
| Bidirectional comms | **Review loops + shared scratchpad** |
| Tool scoping | **Skill scoping + built-in tool restriction** |
| Warm context | **Warm within a workflow** |
| Consensus | **Majority wins, ties flagged** |
| Scratchpad | **File-based** (`.pi/scratch/<id>.md`) |
| Agent format | Keep `.md` frontmatter (add `skills:` field) |
