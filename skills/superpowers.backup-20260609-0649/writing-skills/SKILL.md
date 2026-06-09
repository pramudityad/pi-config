---
name: writing-skills
description: Use when creating new skills, editing existing skills, or verifying skills work before deployment
---

# Writing Skills

## Overview

**Writing skills IS Test-Driven Development applied to process documentation.**

Skills are reference guides for proven techniques, patterns, or tools. Skills help future AI instances find and apply effective approaches.

**Core principle:** If you didn't watch an agent fail without the skill, you don't know if the skill teaches the right thing.

## What is a Skill?

A **skill** is a reference guide for proven techniques, patterns, or tools. Skills help future AI instances find and apply effective approaches.

**Skills are:** Reusable techniques, patterns, tools, reference guides

**Skills are NOT:** Narratives about how you solved a problem once

## TDD Mapping for Skills

| TDD Concept | Skill Creation |
|-------------|----------------|
| **Test case** | Pressure scenario with subagent |
| **Production code** | Skill document (SKILL.md) |
| **Test fails (RED)** | Agent violates rule without skill (baseline) |
| **Test passes (GREEN)** | Agent complies with skill present |
| **Refactor** | Close loopholes while maintaining compliance |
| **Write test first** | Run baseline scenario BEFORE writing skill |
| **Watch it fail** | Document exact rationalizations agent uses |
| **Minimal code** | Write skill addressing those specific violations |
| **Watch it pass** | Verify agent now complies |
| **Refactor cycle** | Find new rationalizations → plug → re-verify |

## When to Create a Skill

**Create when:**
- Technique wasn't intuitively obvious to you
- You'd reference this again across projects
- Pattern applies broadly (not project-specific)
- Others would benefit

**Don't create for:**
- One-off solutions
- Standard practices well-documented elsewhere
- Project-specific conventions (put in .pi/CLAUDE.md)
- Mechanical constraints (if it's enforceable with regex/validation, automate it—save documentation for judgment calls)

## Skill Types

### Technique
Concrete method with steps to follow

### Pattern
Way of thinking about problems

### Reference
API docs, syntax guides, tool documentation

## Directory Structure

```
skills/
  skill-name/
    SKILL.md              # Main reference (required)
    supporting-file.*     # Only if needed
```

## SKILL.md Structure

**Frontmatter (YAML):**
- Two fields: `name` and `description`
- `name`: Use letters, numbers, and hyphens only
- `description`: Start with "Use when..." describing triggering conditions

```markdown
---
name: skill-name-with-hyphens
description: Use when [specific triggering conditions and symptoms]
---

# Skill Name

## Overview
What is this? Core principle in 1-2 sentences.

## When to Use
Bullet list with SYMPTOMS and use cases

## Core Pattern (for techniques/patterns)
Before/after code comparison

## Quick Reference
Table or bullets for scanning common operations

## Common Mistakes
What goes wrong + fixes
```

## Claude Search Optimization (CSO)

**Critical for discovery:** Future AI needs to FIND your skill

### Description Best Practices

**Description = When to Use, NOT What the Skill Does**

The description should ONLY describe triggering conditions. Do NOT summarize the skill's workflow.

```yaml
# ❌ BAD: Summarizes workflow
description: Use when executing plans - dispatches subagent per task with code review

# ✅ GOOD: Just triggering conditions
description: Use when executing implementation plans with independent tasks in the current session
```

### Name Rules

- 1-64 characters
- Lowercase letters, numbers, hyphens only
- No leading/trailing hyphens
- No consecutive hyphens
- Must match parent directory name

## The Iron Law

```
NO SKILL WITHOUT A FAILING TEST FIRST
```

This applies to NEW skills AND EDITS to existing skills.

Write skill before testing? Delete it. Start over.

## Testing Skills

### Discipline-Enforcing Skills (rules/requirements)

Test with:
- Academic questions: Do they understand the rules?
- Pressure scenarios: Do they comply under stress?
- Multiple pressures combined: time + sunk cost + exhaustion
- Identify rationalizations and add explicit counters

**Success criteria:** Agent follows rule under maximum pressure

### Technique Skills (how-to guides)

Test with:
- Application scenarios: Can they apply the technique correctly?
- Variation scenarios: Do they handle edge cases?

**Success criteria:** Agent successfully applies technique to new scenario

### Pattern Skills (mental models)

Test with:
- Recognition scenarios: Do they recognize when pattern applies?
- Application scenarios: Can they use the mental model?

**Success criteria:** Agent correctly identifies when/how to apply pattern

## Common Rationalizations for Skipping Testing

| Excuse | Reality |
|--------|---------|
| "Skill is obviously clear" | Clear to you ≠ clear to other agents. Test it. |
| "Testing is overkill" | Untested skills have issues. Always. |
| "No time to test" | Deploying untested skill wastes more time fixing it later. |

**All of these mean: Test before deploying. No exceptions.**

## Bulletproofing Skills Against Rationalization

Skills that enforce discipline need to resist rationalization. Agents are smart and will find loopholes when under pressure.

### Close Every Loophole Explicitly

Don't just state the rule - forbid specific workarounds:

<Bad>
```markdown
Write code before test? Delete it.
```
</Bad>

<Good>
```markdown
Write code before test? Delete it. Start over.

**No exceptions:**
- Don't keep it as "reference"
- Don't "adapt" it while writing tests
- Don't look at it
- Delete means delete
```
</Good>

### Build Rationalization Table

Capture rationalizations from baseline testing. Every excuse agents make goes in the table:

```markdown
| Excuse | Reality |
|--------|---------|
| "Too simple to test" | Simple code breaks. Test takes 30 seconds. |
| "I'll test after" | Tests passing immediately prove nothing. |
```

## Quality Checks

- [ ] Small flowchart only if decision non-obvious
- [ ] Quick reference table
- [ ] Common mistakes section
- [ ] Supporting files only for tools or heavy reference

## Integration

Skills can reference each other using skill names:
- "Use writing-plans skill"
- "Follow test-driven-development"

This skill set includes skills for:
- Process: brainstorming, writing-plans, executing-plans, subagent-development
- Quality: test-driven-development, systematic-debugging, verification-before-completion
- Workflow: git-worktrees, finishing-development, dispatching-parallel-agents
- Code review: requesting-code-review, receiving-code-review
