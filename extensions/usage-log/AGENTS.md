# Usage-Log Extension — audit skill & extension usage

**Purpose:** Records every skill, extension-tool, and extension-command invocation to a durable, append-only log so you can see which skills/extensions actually get used and prune the never-used ones. Read the audit with `/usage`.

3 files — `index.ts` (wiring + I/O), `usage.ts` (pure helpers), `usage.test.ts`.

## What gets logged (three record kinds)

- **`skill`** — a skill invocation. Skills are **not** tool calls: pi expands a skill (model-invoked *or* `/skill:name`) into a **user-role message** opening with `<skill name="…" location="…">`. Detected via `detectSkillName` on `message_start` (mirrors the SDK's `parseSkillBlock` opening-tag format). `message_start` fires once per message, so no dedup — and unlike `context` it's immune to compaction/fork re-emitting history.
- **`tool`** — an extension-provided or MCP tool call, from `tool_call`. Built-ins (`bash`, `read`, `edit`, `write`, `grep`, `find`, `ls`) are filtered out as noise. The `tool_call` handler returns nothing — returning a `{ block }` result would gate execution.
- **`command`** — an extension slash command (e.g. `/context`), from the `input` event. `/skill:name` is dropped here (it's already counted via the skill block — avoids double-counting), and only `source === "extension"` commands are logged. Prompt-template commands are gated behind `AUDIT_PROMPTS` (off by default: scope is skills + extensions).

## Log location

`~/.pi/usage/usage-YYYY-MM.jsonl` (override with `PI_USAGE_DIR`). Global and cross-project — outside any repo — so it captures usage everywhere pi runs, not only inside pi-config. Monthly files, rotated by the record timestamp in **UTC** (TZ-stable). One JSON object per line; the report skips blank/malformed lines, so a partial write never breaks it. Writes are best-effort and guarded — a logging failure warns once and never blocks the agent.

## `/usage` report

Reads and merges all `usage-*.jsonl`, tallies counts + last-used, and cross-references against the installed inventory (`pi.getCommands()` for skills + extension commands, `pi.getAllTools()` for extension tools) joined **by name** (skill `skill:` prefix stripped; paths are never compared — `parseSkillBlock.location` and `sourceInfo.path` are different path spaces). Subcommands: `/usage` (summary), `/usage unused` (delete candidates only), `/usage skills`, `/usage dump` (log dir + files + line count).

- **Passive extensions** (`permission-gate`, `protected-paths`) register no tools/commands — only event hooks — so they can never be "used" and won't appear in `getCommands()`/`getAllTools()`. The report scans `<agentDir>/extensions/*` on disk and buckets these as *always-on (usage not tracked)* — **never** delete candidates. Attribution extracts the id from the `extensions/<id>` path segment (path-space independent, so it survives the `~/.pi/agent` symlink); the on-disk scan uses `getAgentDir()`, which `readdir` follows through the symlink.
- **MCP tools** (`mcp__…`) are logged when called but aren't local-extension inventory, so if used they surface under *OTHER INVOKED*, not as never-used.

## Conventions

- `usage.ts` is **dependency-free and clock-injected** (callers pass `Date`, helpers never read the clock) so it's deterministic under test — mirrors `ask-human/pending.ts`. All SDK imports and I/O live in `index.ts`.
- Tests: `node --test extensions/usage-log/usage.test.ts` (Node type-stripping; `.ts` imports use explicit extensions). Tests cover only the pure helpers + one temp-dir round-trip — they don't load the SDK.
- Do **not** reset counters on `session_start`; the log is durable/append-only.
- Concurrent appends from parallel subagents rely on POSIX small-write atomicity (single line per write). No file locking — over-engineering at this volume.
