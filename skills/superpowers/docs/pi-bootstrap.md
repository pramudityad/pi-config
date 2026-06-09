# Pi Bootstrap: How Superpowers Skills Load

## Mechanism

Pi auto-discovers skills from `~/.pi/agent/skills/` at startup. Each skill's `description` 
frontmatter field is loaded into the system prompt. When a conversation matches a skill's 
description triggers, the skill is auto-loaded.

Unlike Claude Code's hook-based `session-start` mechanism, Pi uses:

1. **Description-based auto-loading** — Skills trigger when their description matches the conversation context
2. **Manual loading** — `/skill:name` command forces a skill to load
3. **Available skills list** — All skill descriptions are shown in the system prompt as `<available_skills>`

## The Bootstrap Skill

The `using-skills` skill (at `~/.pi/agent/skills/superpowers/using-skills/SKILL.md`) acts as 
the bootstrap. Its description triggers on:

> "Use when starting any conversation"

This means it loads at the start of most sessions, teaching the agent to check 
for other skills before taking action.

### Key bootstrap rules (from using-skills):

1. **Check first**: "If you think there is even a 1% chance a skill might apply, you ABSOLUTELY MUST check."
2. **No exceptions**: "IF A SKILL APPLIES TO YOUR TASK, YOU DO NOT HAVE A CHOICE. YOU MUST USE IT."
3. **Instruction priority**: User instructions > Superpowers skills > Default system prompt
4. **Subagent guard**: `<SUBAGENT-STOP>` prevents subagents from re-loading the bootstrap

## Subagent Guard

The `<SUBAGENT-STOP>` tag in `using-skills/SKILL.md` prevents subagents from 
re-loading the bootstrap, preserving their focused context:

```markdown
<SUBAGENT-STOP>
If you were dispatched as a subagent to execute a specific task, skip this skill.
</SUBAGENT-STOP>
```

## Verification

To verify superpowers is working:

1. Start a new Pi session
2. Say "Let's build a React todo list"  
3. The agent should invoke `brainstorming` before writing any code

If the agent jumps straight to code, superpowers is not loaded correctly.

## Platform Equivalents

| Component | Pi | Claude Code | Codex CLI |
|-----------|-----|-------------|-----------|
| Bootstrap | using-skills auto-load | SessionStart hook | SessionStart hook |
| Skill load | `/skill:name` or auto-match | `Skill` tool | `skill` tool |
| Subagents | `subagent` tool | `Task` tool | `Task` tool |
| Worktrees | git-worktrees skill | EnterWorktree tool | Native worktree |
| Review | requesting-code-review skill | requesting-code-review | same |

## Skill File Structure

```
~/.pi/agent/skills/superpowers/
├── using-skills/SKILL.md          ← Bootstrap (loads first)
├── brainstorming/SKILL.md         ← Design process
├── writing-plans/SKILL.md         ← Implementation plans
├── subagent-development/SKILL.md  ← Execution engine
├── test-driven-development/SKILL.md
├── systematic-debugging/SKILL.md
├── verification-before-completion/SKILL.md
├── git-worktrees/SKILL.md
├── finishing-development/SKILL.md
├── dispatching-parallel-agents/SKILL.md
├── requesting-code-review/SKILL.md
├── receiving-code-review/SKILL.md
├── writing-skills/SKILL.md
├── search-first/SKILL.md          ← Pi addition
└── docs/
    └── pi-bootstrap.md            ← This file
```

## Upstream Sync

This installation is synced with upstream v5.1.0 (github.com/obra/superpowers) 
as of 2026-06-09. Pi-specific adaptations are documented in `../MIGRATION_DELTAS.md`.
