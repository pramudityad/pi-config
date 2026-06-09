---
name: receiving-code-review
description: Use when receiving code review feedback - provides process for addressing review comments
---

# Receiving Code Review

## Overview

Handle code review feedback professionally and effectively.

**Core principle:** Every comment is an opportunity to improve code or clarify thinking.

## The Process

### Step 1: Read All Feedback

Read through all comments before responding. Don't start fixing immediately - you might need to understand the full picture.

### Step 2: Categorize Feedback

For each comment, categorize:

| Type | Action |
|------|--------|
| **Required** | Must fix before merge |
| **Suggestion** | Consider fixing if reasonable |
| **Question** | Answer, may not need code change |
| **Opinion** | Discuss if you disagree |

### Step 3: Address Each Category

**Required changes:**
- Fix the issue
- Show the fix
- Confirm it's resolved

**Suggestions:**
- Implement if valuable
- Explain your reasoning if not

**Questions:**
- Answer clearly
- Provide context if needed

**Opinions (if you disagree):**
- Explain your reasoning
- Provide evidence if possible
- Be open to being convinced

### Step 4: Respond Format

```
## Review Response

### Fixed
- [Issue 1]: [How fixed]
- [Issue 2]: [How fixed]

### Clarified
- [Question]: [Answer]

### Discussing
- [Opinion]: [Your reasoning]
```

## Common Review Comments

| Comment | Response |
|---------|----------|
| "This is confusing" | Simplify or add comments |
| "Why not use X?" | Explain choice or refactor |
| "Missing test" | Add test case |
| "Edge case not handled" | Add handling |
| "Style inconsistency" | Fix to match codebase |

## Red Flags

**Don't:**
- Take feedback personally
- Argue without justification
- Ignore feedback
- Merge without addressing required changes

**Do:**
- Thank reviewers for feedback
- Address all required items
- Ask clarifying questions
- Explain your reasoning

## Example Response

```
## Review Response

### Fixed
- Line 45: Added null check - `if (!user?.id) return;`
- Line 78: Extracted magic number to `MAX_RETRIES` constant

### Clarified
- Q: Why use forEach instead of map?
- A: We're not using return value, just side effects (logging). Changed to for...of for clarity.

### Discussing
- Opinion: I prefer early returns over nested conditionals here
- Reasoning: Reduces indentation, clearer flow. Happy to discuss further if you feel strongly.
```

## Integration

**Pairs with:**
- **requesting-code-review** - The other side of the review process
- **finishing-development** - Use after addressing feedback before merging
