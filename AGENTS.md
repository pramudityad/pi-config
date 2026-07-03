# Global Memory — FLP9damarpramuditya

## Identity
- Full-stack engineer at CloudEats (Java 17, Spring Boot, React 18, TypeScript)
- Pi agent harness user (opencode-go, deepseek-v4-flash)
- Obsidian LYT vault for personal knowledge management
- Works across CloudEats microservices (order-api, kitchen-api, menu-api, inventory-api, central-gateway)

## Workflow Preferences
- Always use git worktree isolation for feature work (never commit on main/dev)
- Prefer GitHub CLI over MCP tools (token efficiency)
- Use systematic-debugging skill before proposing any fix
- Use verification-before-completion skill before declaring done
- Branch flow: dev-alfred → sit-alfred → staging-alfred → master
- Avoid cherry-picking when possible; merge dev→sit directly

## Graphify Integration
Projects with a `graphify-out/` directory have a pre-built knowledge graph. Before answering codebase questions:
1. Check if `graphify-out/graph.json` exists
2. Use `graphify query "<question>"` instead of grepping raw files
3. Use `graphify path "<A>" "<B>"` for relationship paths
4. Use `graphify explain "<concept>"` for focused explanations
5. Read `graphify-out/GRAPH_REPORT.md` only for broad architecture overview

After code changes, run `graphify update <project-root>` to keep the graph current.

## Communication
- Language: English for code/docs, mix of English/Indonesian for internal notes
- JSDoc/TSDoc: required for all exported functions and components
- Commit format: `[TICKET-ID] short description`

## Skill Selection
- TDD skill for new features (test first)
- Brainstorming skill for design decisions
- PR-ready skill before opening PRs
- Dispatching-parallel-agents for independent parallel tasks
- ClickUp skill for task context and updates
- ECC context-switch to check active work across repos
- Graphify skill: check graphify-out/graph.json before answering codebase questions (use `graphify query`, `graphify path`, `graphify explain`)

---

# pi-config — Personal Coding Agent Configuration

**Project Overview:** Pi coding agent configuration for FLP9damarpramuditya — symlinked to `~/.pi/agent`. Custom agents, TypeScript extensions, process skills, and prompt templates.

## Tech Stack

| Component | Tech |
|-----------|------|
| Runtime | Node 22+ (ESM) |
| Lang | TypeScript (no tsconfig — pi SDK handles compilation), Python 3 (browser-use skill), Bash |
| SDK | `@earendil-works/pi-coding-agent`, `@earendil-works/pi-ai`, `@earendil-works/pi-tui`, `@earendil-works/pi-agent-core` |
| Schema | `@sinclair/typebox` (tool parameter schemas) |
| Testing | Native `node --test` (no Jest/Vitest) |
| Diagram | `mermaid ^11.15.0`, `@excalidraw/excalidraw ^0.18.1`, Puppeteer |
| Bundler | `esbuild ^0.28.0` (mermaid-graph only) |
| Default Provider | `opencode-go` (model: `deepseek-v4-flash`) |
| Planning Model | `opencode-go/kimi-k2.7-code` |
| Git Remote | `https://github.com/pramudityad/pi-config.git` |

## Project Structure

```
pi-config/
├── AGENTS.md              # This file — global memory + project config
├── README.md
├── settings.json          # defaultProvider, defaultModel, theme, packages
├── auth.json              # API keys (gitignored)
├── figma.json             # Figma personalAccessToken
├── trust.json             # Trusted paths (~/ and ~/Project/Cloudeats)
│
├── agents/                # 10 agent definitions (*.md with YAML frontmatter)
│   ├── scout.md           # Fast recon (deepseek-v4-flash)
│   ├── planner.md         # Implementation plans (claude-opus)
│   ├── worker.md          # General implementer (deepseek-v4-flash)
│   ├── reviewer.md        # Code review (claude-opus)
│   └── ecc-*.md           # 7 ECC specialist agents
│
├── extensions/            # 7 TypeScript extensions + 2 subpackages
│   ├── subagent/          # SDK-based subagent orchestrator (1100 lines in index.ts)
│   ├── mermaid-graph/     # Mermaid → SVG/PNG/Excalidraw renderer (separate npm package)
│   ├── plan-mode/         # Read-only exploration mode (/plan toggle)
│   ├── context-inspector/ # /context command for context window visibility
│   ├── markdown-graph.ts  # Terminal Unicode diagram renderer (547 lines)
│   ├── protected-paths.ts # Blocks write to .env, .git/, node_modules/
│   ├── permission-gate/   # Confirms destructive bash cmds + protected-branch gate (index.ts + tests)
│   └── search.json        # Search backend config (duckduckgo, marginalia, jina)
│
├── skills/                # 20+ skill directories
│   ├── superpowers/       # 14 process skills (obra/superpowers v5.1.0, 47 files)
│   ├── pi-skills/         # 10 built-in pi integration skills
│   │   ├── browser-tools/ # CDP browser automation (10 JS scripts)
│   │   ├── gccli/         # Google Calendar
│   │   ├── gdcli/         # Google Drive
│   │   ├── gmcli/         # Gmail
│   │   ├── jiracli/       # Jira CLI
│   │   ├── pgcli/         # PostgreSQL CLI
│   │   ├── transcribe/    # Audio transcription
│   │   ├── vscode/        # VS Code integration
│   │   └── youtube-transcript/ # YouTube transcripts
│   ├── browser-use/       # Python-based autonomous web agent (.venv)
│   ├── clickup/           # ClickUp task management
│   ├── cloudeats-git-checkout/ # (empty)
│   ├── daily-compile/     # Daily compilation templates
│   ├── ecc-api-design/    # REST API conventions
│   ├── ecc-backend-patterns/   # Node.js/Express patterns
│   ├── ecc-coding-standards/   # TypeScript/React standards
│   ├── ecc-context-switch/     # Active work dashboard across repos
│   ├── ecc-e2e-testing/   # Playwright testing
│   ├── ecc-frontend-patterns/  # React/Next.js patterns
│   ├── ecc-pr-ready/      # Pre-PR checklist
│   ├── ecc-security-review/   # Security audit checklist
│   ├── ecc-standup-generator/ # Standup report
│   ├── graphify/          # Knowledge graph builder
│   └── tmux/              # Tmux session management
│
├── prompts/               # 5 prompt templates for subagent chains
│   ├── init-agents-md.md  # Scout → Worker: generate AGENTS.md
│   ├── scout-and-plan.md  # Scout → Planner
│   ├── implement.md       # Scout → Planner → Worker
│   ├── implement-and-review.md # Worker ↔ Reviewer loop
│   └── first-mate.md      # Orchestrator: decompose → dispatch → quality → report
│
├── docs/plans/            # 7 design docs + implementation plans
├── sessions/              # ~180 JSONL session logs from various repos (gitignored)
├── npm/                   # pi-extensions package (pi-figma, pi-search-hub)
│   └── package.json       # dependencies: pi-figma ^1.0.1, pi-search-hub ^2.8.0
├── themes/                # monochrome-teal.json custom dark theme
├── scripts/               # pi-status.sh
├── git/                   # Git hooks, 3rd-party plugin checkouts
│   └── github.com/{DietrichGebert/ponytail, mvanhorn/}
├── .pi/
│   └── runs/              # Durable run state (subagent persistence)
└── .worktrees/            # (empty — gitignored)
```

## Common Commands

```bash
# Status
bash scripts/pi-status.sh              # Git status + recent commits
git status -sb                         # Quick branch status

# Subagent tests
node --test extensions/subagent/*.test.ts   # Run all subagent tests
node --test extensions/subagent/agents.test.ts
node --test extensions/subagent/consensus.test.ts
node --test extensions/subagent/runstate.test.ts
node --test extensions/subagent/scratchpad.test.ts

# Mermaid-graph tests
cd extensions/mermaid-graph
node build.mjs                          # Bundle to dist/bundle.js
node --test 'test/**/*.test.mjs'        # Run render + preview tests

# Git workflow
git add -p
git commit -m "[TICKET-ID] short description"
git log --oneline -5
```

## Environment Setup

**This repo is symlinked to `~/.pi/agent`. Setup is already done.**

```bash
ls -la ~/.pi/agent  # → /Users/FLP9damarpramuditya/git/pi-config
```

Required files (gitignored, must exist in the repo root):

| File | Content |
|------|---------|
| `auth.json` | API keys for opencode-go (DeepSeek), anthropic (Claude), github-copilot, zai |
| `.env` | Environment variables (if any) |

Trusted paths (in `trust.json`): `~/` and `~/Project/Cloudeats`

Packages loaded (from `settings.json`):
- `npm:pi-figma` — Figma design tool integration
- `npm:pi-search-hub` — Multi-backend web search (duckduckgo, marginalia, jina)
- `git:github.com/mvanhorn/last30days-skill` — Git activity tracking
- `git:github.com/DietrichGebert/ponytail` — Ponytail MCP plugin

## Agent Definitions

All agents live in `agents/*.md` with YAML frontmatter:

```yaml
---
name: agent-name
description: What this agent does
tools: read, bash, grep, find, ls     # Scoped tool access
skills: pgcli, ecc-backend-patterns    # Optional: scoped skill loading
model: opencode-go/kimi-k2.7-code       # Model override
---
```

Two model tiers: **claude-opus** (planning/review/architecture) and **deepseek-v4-flash** (execution/fixing). Agents with no `skills:` field load zero skills (lean).

## Subdirectory Guides

- [`extensions/subagent/AGENTS.md`](./extensions/subagent/AGENTS.md) — SDK subagent orchestrator (5 modes, run persistence, consensus)
- [`extensions/mermaid-graph/AGENTS.md`](./extensions/mermaid-graph/AGENTS.md) — Mermaid → SVG/PNG/Excalidraw render extension
- [`skills/superpowers/AGENTS.md`](./skills/superpowers/AGENTS.md) — 14 process skills adapted from obra/superpowers v5.1.0
- [`skills/pi-skills/browser-tools/AGENTS.md`](./skills/pi-skills/browser-tools/AGENTS.md) — CDP browser automation scripts
- [`docs/plans/AGENTS.md`](./docs/plans/AGENTS.md) — Architecture design docs & implementation plans
