---
name: using-skills
description: Use when starting any conversation - establishes how to find and use skills before taking any action
---

<SUBAGENT-STOP>
If you were dispatched as a subagent to execute a specific task, skip this skill.
</SUBAGENT-STOP>

<EXTREMELY-IMPORTANT>
If you think there is even a 1% chance a skill might apply to what you are doing, you ABSOLUTELY MUST check for available skills.

IF A SKILL APPLIES TO YOUR TASK, YOU DO NOT HAVE A CHOICE. YOU MUST USE IT.

This is not negotiable. This is not optional. You cannot rationalize your way out of this.
</EXTREMELY-IMPORTANT>

## Instruction Priority

Superpowers skills override default system prompt behavior, but **user instructions always take precedence**:

1. **User's explicit instructions** (.pi/CLAUDE.md, AGENTS.md, direct requests) — highest priority
2. **Superpowers skills** — override default system behavior where they conflict
3. **Default system prompt** — lowest priority

If .pi/CLAUDE.md or AGENTS.md says "don't use TDD" and a skill says "always use TDD," follow the user's instructions. The user is in control.

## How to Access Skills

**In Pi:** Use the `/skill:name` command to load a skill. Skills are also automatically loaded when the system prompt detects a match based on skill descriptions.

**In Claude Code:** Use the `Skill` tool. When you invoke a skill, its content is loaded and presented to you—follow it directly. Never use the Read tool on skill files.

**In Copilot CLI:** Use the `skill` tool. Skills are auto-discovered from installed plugins.

**In Gemini CLI:** Skills activate via the `activate_skill` tool. Gemini loads skill metadata at session start and activates the full content on demand.

**In other environments:** Check your platform's documentation for how skills are loaded.

## Platform Adaptation

Skills use Pi-native tool names and conventions. Non-Pi platforms: see `references/pi-tools.md` for tool equivalents across Claude Code, Codex CLI, Copilot CLI, and Gemini CLI.

## The Rule

**Check for relevant or requested skills BEFORE any response or action.** Even a 1% chance a skill might apply means that you should check. If a skill turns out to be wrong for the situation, you don't need to use it.

```mermaid
flowchart TD
    A["User message received"] --> B{Might any skill apply?}
    B -->|yes, even 1%| C[Invoke /skill:name or auto-load]
    B -->|definitely not| D[Respond normally]
    
    C --> E["Announce: 'Using [skill] to [purpose]'"]
    E --> F{Has checklist?}
    F -->|yes| G[Create todo items per checklist]
    F -->|no| H[Follow skill exactly]
    G --> H
    H --> D
    
    A2["About to plan?"] --> G2{Brainstormed?}
    G2 -->|no| H2[Invoke brainstorming skill]
    G2 -->|yes| B
    H2 --> B
```

## Red Flags

These thoughts mean STOP—you're rationalizing:

| Thought | Reality |
|---------|---------|
| "This is just a simple question" | Questions are tasks. Check for skills. |
| "I need more context first" | Skill check comes BEFORE clarifying questions. |
| "Let me explore the codebase first" | Skills tell you HOW to explore. Check first. |
| "I can check git/files quickly" | Files lack conversation context. Check for skills. |
| "Let me gather information first" | Skills tell you HOW to gather information. |
| "This doesn't need a formal skill" | If a skill exists, use it. |
| "I remember this skill" | Skills evolve. Read current version. |
| "This doesn't count as a task" | Action = task. Check for skills. |
| "The skill is overkill" | Simple things become complex. Use it. |
| "I'll just do this one thing first" | Check BEFORE doing anything. |
| "This feels productive" | Undisciplined action wastes time. Skills prevent this. |
| "I know what that means" | Knowing the concept ≠ using the skill. Invoke it. |

## Skill Priority

When multiple skills could apply, use this order:

1. **Process skills first** (brainstorming, systematic-debugging) - these determine HOW to approach the task
2. **Implementation skills second** (test-driven-development, writing-plans) - these guide execution

"Let's build X" → brainstorming first, then implementation skills.
"Fix this bug" → systematic-debugging first, then domain-specific skills.

## Skill Types

**Rigid** (test-driven-development, systematic-debugging): Follow exactly. Don't adapt away discipline.

**Flexible** (patterns): Adapt principles to context.

The skill itself tells you which.

## User Instructions

Instructions say WHAT, not HOW. "Add X" or "Fix Y" doesn't mean skip workflows.

## Available Skills

This skill set includes:

- **brainstorming** - Turn ideas into designs before implementation
- **writing-plans** - Create detailed implementation plans
- **executing-plans** - Execute plans in separate sessions
- **subagent-development** - Execute plans with subagents in current session
- **test-driven-development** - TDD methodology
- **systematic-debugging** - Debugging methodology
- **dispatching-parallel-agents** - Run multiple subagents in parallel
- **finishing-development** - Complete development and merge
- **git-worktrees** - Isolated workspaces
- **requesting-code-review** - Code review process
- **receiving-code-review** - Handle code review feedback
- **verification-before-completion** - Verify before claiming done
- **writing-skills** - Create new skills
