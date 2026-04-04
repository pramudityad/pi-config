# Subagent-Development Skill Improvements

**Date:** 2026-04-01
**Status:** Approved

## Problem

Current subagent-development skill has:
- Confusing "Hybrid Approach" that doesn't clearly distinguish Manual vs Extension mode
- No concrete mode selection mechanism
- Reviewer subagents referenced but not defined
- Vague "dispatch" language without actual `subagent` tool syntax
- No error handling for review loops

## Solution

Targeted refactor keeping current structure with focused improvements:

### 1. Mode Selection (New Section)

Add explicit mode selection at workflow start:
- Ask user: Manual Mode (user implements) or Extension Mode (subagents)
- If Extension Mode selected but agents not found, fall back to Manual Mode

### 2. Restructure Hybrid Approach

Split into two clear subsections:
- **Manual Mode:** Agent as controller, user as implementer, inline checklists
- **Extension Mode:** Concrete `subagent` tool dispatch patterns

### 3. Spec Compliance Checklist (Inline)

Self-contained checklist embedded in skill:
- All explicit requirements implemented
- No extra features beyond spec
- Edge cases handled
- No scope creep
- Tests cover specified behavior

### 4. Review Loop Limit

Max 3 cycles per task. After 3 failures:
- Stop and present issue to user
- Show: spec, failures, attempts
- Ask: clarify, pair-program, or skip

### 5. Subagent Tool Syntax

Concrete examples for Extension Mode:
- Implementer dispatch pattern
- Spec reviewer dispatch pattern
- Quality reviewer dispatch pattern

### 6. Minor Fixes

- Remove vague "if available" language
- Clarify Manual Mode = user implements
- Reference finishing-development for "4 options" red flag
- Add todo tracking guidance

## Implementation

Single file edit to: `/Users/FLP9damarpramuditya/.pi/agent/skills/superpowers/subagent-development/SKILL.md`

## Decisions Made

1. **Mode selection:** Ask user at start (not auto-detect)
2. **Reviewer prompts:** Inline spec checklist, reference requesting-code-review for quality
3. **Error handling priority:** Review loop limits (3 cycles max)
4. **Approach:** Minimal refactor (self-contained, single skill change)
