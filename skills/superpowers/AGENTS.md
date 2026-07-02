# Superpowers — Process Discipline Skills

**Purpose:** 14 process skills adapted from [obra/superpowers](https://github.com/obra/superpowers) v5.1.0. Enforce rigorous development discipline: root-cause debugging, verification before completion, TDD, search-first, and structured planning.

47 files across 14 skill directories. Synced 2026-06-09.

## File Conventions

- **Skill root:** Each skill is a directory with a mandatory `SKILL.md` file
- **Frontmatter:** YAML in `SKILL.md` with exactly `name` and `description` fields
- **Body:** Full system prompt / skill instructions in markdown
- **Supporting files:** Skills may include examples, scripts, or reference docs alongside `SKILL.md`
- **Naming:** Lower-kebab-case directory names — `systematic-debugging/`, `verification-before-completion/`

## Skill Inventory

| Skill | Purpose | Supporting Files |
|-------|---------|-----------------|
| `brainstorming` | Feature exploration & design | — |
| `dispatching-parallel-agents` | Parallel task execution | — |
| `executing-plans` | Execute written plans in separate session | — |
| `finishing-development` | Completion workflows | — |
| `git-worktrees` | Isolated git worktree development | `docs/` |
| `receiving-code-review` | Handle PR feedback | — |
| `requesting-code-review` | Prepare PRs for review | — |
| `search-first` | Research before coding | — |
| `subagent-development` | Multi-agent task execution | — |
| `systematic-debugging` | Root-cause debugging methodology | 10 files (root-cause-tracing.md, defense-in-depth.md, find-polluter.sh, test-pressure-*.md, etc.) |
| `test-driven-development` | Red-green-refactor TDD | — |
| `using-skills` | How to find and use skills | — |
| `verification-before-completion` | Pre-completion checklists | — |
| `writing-plans` | Create multi-step implementation plans | — |
| `writing-skills` | Author new skills | — |

## Architecture Patterns

- **Meta skill:** `using-skills` is the entry point — loaded first to teach the agent how to discover and invoke other skills
- **Process chain:** `brainstorming` → `writing-plans` → `executing-plans` (or `subagent-development`) → `verification-before-completion`
- **Bug fix path:** `systematic-debugging` first (root cause), then `test-driven-development` (repro test), then fix
- **Skill loading:** pi agent loads skills on demand — skill is only active when explicitly invoked via `/skill:name` or auto-detected
- **No code, only prompts:** Skills are purely markdown instructions to the LLM — no executable code in most skills (exceptions: `systematic-debugging` has shell scripts)

## Do's and Don'ts

- **Do** keep each `SKILL.md` focused on one process — no multi-skill files
- **Do** add supporting files (examples, scripts) alongside `SKILL.md` when they help illustrate the process
- **Do** cross-reference other skills internally (e.g., "Use `systematic-debugging` before fixing")
- **Don't** put executable code in `SKILL.md` body — put it in separate files
- **Don't** duplicate content from upstream — diff against obra/superpowers on update
- **Don't** add project-specific instructions (that belongs in skill content or AGENTS.md)

## Migration & Maintenance

- `MIGRATION_MATRIX.md` — Maps original superpowers skills → pi superpowers
- `MIGRATION_DELTAS.md` — Detailed changes per skill during adaptation
- `GO_NO_GO_CHECKLIST.md` — Decision framework for when to use superpowers
- `README.md` — Quick start guide for new users
