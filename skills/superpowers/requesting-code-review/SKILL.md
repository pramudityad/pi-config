---
name: requesting-code-review
description: Use when code is ready for review - provides structured code review template and process
---

# Requesting Code Review

## Overview

Present code changes in a structured format that helps reviewers provide effective feedback.

**Core principle:** Make it easy for reviewers to understand what changed, why, and how to test.

## When to Use

- After completing implementation tasks
- Before merging to main branch
- After subagent-development or executing-plans completes

## The Process

### Step 1: Prepare Changes Summary

For each changed file, provide:
- **File path**: Exact location
- **Changes**: Brief description of what changed
- **Reason**: Why this change was needed

### Step 2: Provide Test Evidence

Show:
- Test command run
- Output showing tests passing
- Any manual verification performed

### Step 3: Present for Review

Structure your message:

```
## Code Review Request

### Summary
[Brief description of what was implemented]

### Changes
- `src/file.ts`: [What changed]
- `tests/file.test.ts`: [What changed]

### Test Results
```
[test output]
```

### Areas of Focus
[Optional: specific areas you'd like reviewer to pay attention to]

### Questions
[Optional: specific questions for reviewer]
```

## Review Template

When asking someone to review, provide:

```markdown
## Review Focus

**Type:** Feature / Bugfix / Refactor

**What works:**
- [List what is correct]

**What I'm unsure about:**
- [List areas needing extra attention]

**Testing:**
- [How to verify the changes work]

**Specific questions:**
1. [Question 1]
2. [Question 2]
```

## Common Mistakes

**❌ No context:** "Can you review this?"
**✅ Rich context:** Explain what, why, and how to test

**❌ Untested code:** "I think it works"
**✅ Verified:** Show test output

**❌ Huge diffs:** 50 files at once
**✅ Focused:** Smaller, incremental reviews

## What Reviewers Look For

1. **Correctness** - Does the code do what it's supposed to?
2. **Design** - Is the code well-structured?
3. **Readability** - Is the code easy to understand?
4. **Testing** - Are there adequate tests?
5. **Security** - Any security concerns?

## After Review

When feedback is received:
1. **Don't take it personally** - Review is for the code
2. **Address all points** - Either fix or explain
3. **Ask clarifying questions** - If feedback is unclear
4. **Thank the reviewer** - Their time is valuable

## Integration

**Used by:**
- **subagent-development** - After each task for code quality review
- **finishing-development** - Before presenting merge/PR options
