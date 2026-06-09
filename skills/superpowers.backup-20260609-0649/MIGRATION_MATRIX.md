# OpenCode Superpowers → Pi Skills Migration

## Naming Map

| OpenCode Directory | Pi Skill ID | Notes |
|-------------------|--------------|-------|
| brainstorming | brainstorming | Same name |
| dispatching-parallel-agents | dispatching-parallel-agents | Same (keep descriptive) |
| executing-plans | executing-plans | Same |
| finishing-a-development-branch | finishing-development | Shorter, clear |
| receiving-code-review | receiving-code-review | Same |
| requesting-code-review | requesting-code-review | Same |
| subagent-driven-development | subagent-development | Shorter, clear |
| systematic-debugging | systematic-debugging | Same |
| test-driven-development | test-driven-development | Same |
| using-git-worktrees | git-worktrees | Shorter |
| using-superpowers | using-skills | Renamed for Pi context |
| verification-before-completion | verification-before-completion | Same |
| writing-plans | writing-plans | Same |
| writing-skills | writing-skills | Same |

## Supporting Files Migration

| Source | Target | Notes |
|--------|--------|-------|
| requesting-code-review/code-reviewer.md | requesting-code-review/reviewer-template.md | Rename for clarity |
| subagent-driven-development/*.md | subagent-development/*.md | Move to skill dir |
| systematic-debugging/condition-based-waiting.md | systematic-debugging/condition-based-waiting.md | Keep inline ref |
| systematic-debugging/condition-based-waiting-example.ts | systematic-debugging/condition-based-waiting-example.ts | Keep inline ref |
| systematic-debugging/defense-in-depth.md | systematic-debugging/defense-in-depth.md | Keep inline ref |
| systematic-debugging/root-cause-tracing.md | systematic-debugging/root-cause-tracing.md | Keep inline ref |
| systematic-debugging/find-polluter.sh | systematic-debugging/find-polluter.sh | Utility script |
| systematic-debugging/test-*.md | systematic-debugging/test-*.md | Pressure test scenarios |
| systematic-debugging/CREATION-LOG.md | ❌ | Skip - internal doc |
| test-driven-development/testing-anti-patterns.md | test-driven-development/testing-anti-patterns.md | Keep inline ref |
| writing-skills/anthropic-best-practices.md | writing-skills/anthropic-best-practices.md | Keep inline ref |
| writing-skills/persuasion-principles.md | writing-skills/persuasion-principles.md | Keep inline ref |
| writing-skills/testing-skills-with-subagents.md | writing-skills/testing-skills-with-subagents.md | Keep inline ref |
| writing-skills/examples/*.md | writing-skills/examples/*.md | Keep examples |
| writing-skills/graphviz-conventions.dot | ❌ | Skip - Graphviz ref |
| writing-skills/render-graphs.js | ❌ | Skip - rendering tool |

## Directory Structure (Final)

```
~/.pi/agent/skills/
└── superpowers/
    ├── README.md                           # Master index
    ├── brainstorming/
    │   └── SKILL.md
    ├── brainstorming-designs/              # ALIAS if needed
    ├── dispatching-parallel-agents/
    │   └── SKILL.md
    ├── executing-plans/
    │   └── SKILL.md
    ├── finishing-development/
    │   └── SKILL.md
    ├── receiving-code-review/
    │   └── SKILL.md
    ├── requesting-code-review/
    │   ├── SKILL.md
    │   └── reviewer-template.md
    ├── subagent-development/
    │   ├── SKILL.md
    │   ├── implementer-prompt.md
    │   ├── spec-reviewer-prompt.md
    │   └── code-quality-reviewer-prompt.md
    ├── systematic-debugging/
    │   ├── SKILL.md
    │   ├── condition-based-waiting.md
    │   ├── condition-based-waiting-example.ts
    │   ├── defense-in-depth.md
    │   ├── root-cause-tracing.md
    │   ├── find-polluter.sh
    │   └── test-*.md (pressure tests)
    ├── test-driven-development/
    │   ├── SKILL.md
    │   └── testing-anti-patterns.md
    ├── git-worktrees/
    │   └── SKILL.md
    ├── using-skills/
    │   └── SKILL.md
    ├── verification-before-completion/
    │   └── SKILL.md
    ├── writing-plans/
    │   └── SKILL.md
    └── writing-skills/
        ├── SKILL.md
        ├── anthropic-best-practices.md
        ├── persuasion-principles.md
        ├── testing-skills-with-subagents.md
        └── examples/
            └── CLAUDE_MD_TESTING.md
```
