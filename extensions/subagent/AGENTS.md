# Subagent Extension — SDK-based Subagent Orchestrator

**Purpose:** In-process subagent delegation via `createAgentSession()` (not CLI spawn). Supports 5 modes: single, parallel, chain, review, consensus.

8 source modules + tests, ~2500 lines TypeScript. Tests via `node --test`.

## Code Conventions

- **Imports:** ES modules using `import type` for type-only imports. Standard library imports use `node:` prefix (`import * as fs from "node:fs"`)
- **SDK imports:** `@earendil-works/pi-coding-agent`, `@earendil-works/pi-ai`, `@earendil-works/pi-tui`, `@earendil-works/pi-agent-core`, `@sinclair/typebox`
- **File naming:** lower-kebab-case.ts — `runstate.ts`, `scratchpad.ts`, `consensus.ts`
- **Test files:** Same name with `.test.ts` suffix — `runstate.test.ts`, `scratchpad.test.ts`
- **Extension entry:** `export default function(pi: ExtensionAPI) { pi.registerTool({ name: "subagent", ... }) }`
- **JSDoc:** Required on every exported function. Block comments for module-level docs (`/** ... */`)
- **Parameter schemas:** `Type.Object({...})` from `@sinclair/typebox` with inline `description`
- **Render functions:** `renderCall(args, theme)` returns `new Text(...)`, `renderResult(result, options, theme)` returns `Text | Container`
- **No external dependencies** — only pi SDK and Node stdlib

## Architecture Patterns

```
index.ts (tool registration, 5 modes)
├── agents.ts         — Agent discovery, frontmatter parsing, scoping
├── orchestrator.ts   — Session creation, runSingleAgent, SessionCache
├── consensus.ts      — Vote normalization + majority resolution
├── structured.ts     — Trailing-JSON output contracts (consensus answer, review verdict)
├── scratchpad.ts     — File-based scratchpad lifecycle (.pi/scratch/*.md)
└── runstate.ts       — Durable run persistence (.pi/runs/*.json)
```

- **Agent discovery:** `discoverAgents(cwd, scope)` loads `.md` files from user `agents/` dir and/or project `.pi/agents/` dir. `parseFrontmatter()` from pi SDK extracts YAML frontmatter.
- **Session reuse:** `SessionCache` in orchestrator reuses agent sessions across chain steps (warm sessions).
- **Concurrency:** `mapWithConcurrencyLimit()` limits parallel tasks to `MAX_CONCURRENCY = 4`.
- **Structured contracts:** consensus voters and review reviewers append a trailing-JSON contract (`structured.ts`); `extractAnswer()`/`extractVerdict()` parse the block with graceful fallback to prose.
- **Fan-out budget guard:** `guardFanoutBudget()` checks parent `getContextUsage()` before parallel/consensus/chain/review dispatch; at ≥`FANOUT_BUDGET_GUARD_PERCENT` (85%) it confirms (UI) or refuses (headless).
- **Resumable chains:** Failed chain steps persist to `.pi/runs/<id>.json`. Resuming with the same `runId` and fingerprint skips completed steps using `resumableSteps()`.
- **Scratchpad:** Shared file at `.pi/scratch/<id>.md` — agents read/write for cross-agent context. Enabled via `scratchpad: true`.
- **Timer injection:** Runstate module takes timestamps from the caller (never reads `new Date()` internally) so tests are deterministic.
- **Frontmatter fields parsed:** `name`, `description`, `tools`, `skills` (comma-separated), `model`

## Do's and Don'ts

- **Do** use `import type` for type-only imports
- **Do** name test files `<module>.test.ts` and use `node --test`
- **Do** use `os.tmpdir()` + `fs.mkdtempSync()` for temp test directories
- **Do** pass timestamps into runstate functions (don't call `new Date()` inside)
- **Don't** add external npm dependencies — pi SDK + Node stdlib only
- **Don't** import from other extension modules (subagent is standalone)
- **Don't** use `console.log` — use `ctx.ui.confirm()` or `onUpdate()` for user interaction
- **Don't** mutate `params` — treat them as readonly

## Testing

```bash
# Run all subagent tests
node --test extensions/subagent/*.test.ts

# Run individual test
node --test extensions/subagent/scratchpad.test.ts
```

- Framework: Native `node:test` with `node:assert`
- Pattern: `test("description", () => { ... })` — no describe/it nesting
- Temp files: `fs.mkdtempSync(path.join(os.tmpdir(), "prefix-"))` + `fs.rmSync(dir, { recursive: true, force: true })` in each test
- Tests cover: frontmatter parsing, agent discovery, scratchpad create/cleanup, runstate persistence, consensus resolution, structured output parsing
