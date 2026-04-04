# Subagent-Development Skill Improvements Implementation Plan

> **For AI:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.

**Goal:** Improve the subagent-development skill with clear mode selection, concrete subagent syntax, inline review checklists, and error handling.

**Architecture:** Single-file refactor of SKILL.md with targeted additions: mode selection section, restructured hybrid approach, inline spec compliance checklist, review loop limits, and subagent tool syntax examples.

**Tech Stack:** Markdown, Pi skill format (YAML frontmatter + markdown)

---

## Task 1: Add Mode Selection Section

**Files:**
- Modify: `/Users/FLP9damarpramuditya/.pi/agent/skills/superpowers/subagent-development/SKILL.md`

**Step 1: Add mode selection after "The Process" flowchart**

Insert new section before "The Pattern":

```markdown
### 0. Select Mode

Before starting execution, ask the user:

> "I'll execute this plan using subagent-development. Which mode would you like?"
>
> **A) Manual Mode** — You implement each task while I guide and review. Works in any Pi setup.
> **B) Extension Mode** — I dispatch subagents to implement and review. Requires `.pi/agents/` with implementer/reviewer agents defined.

If Extension Mode is selected but required agents are not found, inform the user and fall back to Manual Mode:

> "Extension Mode requires agent definitions in `.pi/agents/`. I don't see them, so I'll use Manual Mode instead."
```

---

## Task 2: Restructure Hybrid Approach Section

**Files:**
- Modify: `/Users/FLP9damarpramuditya/.pi/agent/skills/superpowers/subagent-development/SKILL.md`

**Step 1: Replace the entire "Hybrid Approach for Pi" section**

Find the section starting with `## Hybrid Approach for Pi` and ending before `## Example Workflow`.

Replace with:

```markdown
## Manual Mode

In Manual Mode, you (the agent) act as the controller while the user implements:

1. **Present task** — Give user the full task text + context
2. **User implements** — User writes code, you guide and answer questions
3. **You review (spec compliance)** — Use the Spec Compliance Checklist below
4. **You review (code quality)** — Reference the requesting-code-review skill
5. **Loop or proceed** — If review fails, user fixes and you re-review (max 3 cycles)
6. **Commit** — User commits when both reviews pass
7. **Next task** — Move to the next task

### Spec Compliance Checklist

Verify the implementation matches the task spec exactly:

- [ ] All explicit requirements from the task are implemented
- [ ] No extra features added beyond what the spec requires
- [ ] Edge cases mentioned in the task spec are handled
- [ ] No changes to files or components outside the task scope
- [ ] Tests cover the behavior specified in the task

If any checklist item fails → send back to implementer with specific gaps to address.

### Code Quality Review

After spec compliance passes, review code quality using the **requesting-code-review** skill checklist:

- Test coverage and test quality
- Code clarity and naming
- No magic numbers or hardcoded values
- Proper error handling
- Follows project coding standards

## Extension Mode

In Extension Mode, you dispatch subagents for implementation and review:

1. **Dispatch implementer** — Send task + context to implementer subagent
2. **Implementer works** — Follows TDD, self-reviews, commits
3. **Dispatch spec reviewer** — Verify spec compliance using the checklist
4. **Dispatch quality reviewer** — Verify code quality using requesting-code-review
5. **Loop or proceed** — If review fails, dispatch implementer to fix (max 3 cycles)
6. **Next task** — Move to the next task

### Subagent Dispatch Patterns

**Implementer dispatch:**

```
subagent({
  agent: "implementer",
  task: `[full task text from plan]

Context: [relevant files, dependencies, constraints]

Requirements:
- Follow test-driven-development skill
- Write tests first, then implementation
- Commit when all tests pass
- Self-review before returning

Report: What you implemented, tests added, any blockers`
})
```

**Spec compliance reviewer dispatch:**

```
subagent({
  agent: "reviewer",
  task: `Review spec compliance for task: [task name]

Task spec:
[full task text]

Files changed: [list of modified/created files]

Checklist:
- [ ] All explicit requirements implemented
- [ ] No extra features beyond spec
- [ ] Edge cases handled
- [ ] No scope creep
- [ ] Tests cover specified behavior

Report: PASS or FAIL with specific gaps`
})
```

**Code quality reviewer dispatch:**

```
subagent({
  agent: "reviewer",
  task: `Review code quality for task: [task name]

Files changed: [list of modified/created files]

Use the requesting-code-review skill checklist:
- Test coverage and quality
- Code clarity and naming
- No magic numbers
- Error handling
- Coding standards

Report: PASS or FAIL with specific issues`
})
```
```

---

## Task 3: Add Review Loop Limit Section

**Files:**
- Modify: `/Users/FLP9damarpramuditya/.pi/agent/skills/superpowers/subagent-development/SKILL.md`

**Step 1: Add after the Extension Mode section**

Insert before `## Example Workflow`:

```markdown
## Review Loop Limit

**Maximum 3 review cycles per task.** After 3 failed attempts, stop and escalate:

1. **Stop the loop** — Don't attempt another review cycle
2. **Present the issue to the user:**
   - Original task spec
   - What's failing (spec compliance or code quality)
   - Specific issues found in each attempt
   - What was tried to fix them
3. **Ask the user how to proceed:**
   - **Clarify the spec** — If requirements are ambiguous
   - **Pair-program** — Work together to resolve the issue
   - **Skip the task** — Move on and revisit later
   - **Abort the plan** — Stop execution entirely

This prevents endless loops and surfaces ambiguous specs early.
```

---

## Task 4: Update Red Flags Section

**Files:**
- Modify: `/Users/FLP9damarpramuditya/.pi/agent/skills/superpowers/subagent-development/SKILL.md`

**Step 1: Update the Red Flags section**

Find the `## Red Flags` section and replace with:

```markdown
## Red Flags

**Never:**
- Start implementation on main/master branch without explicit user consent
- Skip reviews (spec compliance OR code quality)
- Proceed with unfixed issues
- Move to next task while either review has open issues
- Start code quality review before spec compliance is approved
- Exceed 3 review cycles without escalating to user

**Always:**
- Ask user to select mode before starting
- Verify tests pass before offering completion options
- Track tasks (in conversation or write to `docs/plans/<plan-name>-tasks.md`)
- Escalate to user after 3 failed review cycles
- Use finishing-development skill when all tasks complete
```

---

## Task 5: Update Integration Section

**Files:**
- Modify: `/Users/FLP9damarpramuditya/.pi/agent/skills/superpowers/subagent-development/SKILL.md`

**Step 1: Update the Integration section**

Find the `## Integration` section and update:

```markdown
## Integration

**Required workflow skills:**
- **git-worktrees** — REQUIRED: Set up isolated workspace before starting
- **writing-plans** — Creates the plan this skill executes
- **finishing-development** — Complete development after all tasks
- **requesting-code-review** — Code quality review checklist (both modes)

**Subagents should use:**
- **test-driven-development** — Follow TDD for each task

**Alternative workflow:**
- **executing-plans** — Use for parallel session instead of same-session execution

**Mode selection:**
- Manual Mode works with any Pi setup
- Extension Mode requires `.pi/agents/` with implementer and reviewer agents
```

---

## Task 6: Update Example Workflow

**Files:**
- Modify: `/Users/FLP9damarpramuditya/.pi/agent/skills/superpowers/subagent-development/SKILL.md`

**Step 1: Update the Example Workflow section**

Replace the `## Example Workflow` section with:

```markdown
## Example Workflow (Manual Mode)

```
You: I'll execute this plan using subagent-development. Which mode?
    A) Manual Mode — You implement, I review
    B) Extension Mode — I dispatch subagents

User: A, Manual Mode

You: Great. I've read the plan and identified 5 tasks.
    Tracking in: docs/plans/feature-plan-tasks.md

    Starting Task 1: Hook installation script

    [Present full task text + context]

    Ready for you to implement. Let me know when done or if you have questions.

User: [implements] Done!

You: Reviewing spec compliance...
    ✅ All requirements met
    ✅ No scope creep
    ⚠️ Missing: edge case for empty config file

    Please add handling for empty config, then I'll re-review.

User: [fixes] Fixed.

You: Spec compliance: ✅
    Code quality review...
    ✅ Good test coverage
    ✅ Clean code
    Approved!

    Please commit, then we'll move to Task 2.

User: Committed.

You: Task 1 complete. Moving to Task 2...
    [Continue...]

[After all tasks]

You: All 5 tasks complete. Using finishing-development skill...
```

## Example Workflow (Extension Mode)

```
You: I'll execute this plan using subagent-development. Which mode?
    A) Manual Mode — You implement, I review
    B) Extension Mode — I dispatch subagents

User: B, Extension Mode

You: Checking for required agents...
    ✅ Found implementer agent
    ✅ Found reviewer agent
    
    Starting Task 1: Hook installation script

    [Dispatch implementer subagent]
    Implementer: Implemented, tests pass, committed.

    [Dispatch spec reviewer subagent]
    Spec reviewer: FAIL - missing empty config edge case

    [Dispatch implementer to fix]
    Implementer: Fixed, tests pass, amended commit.

    [Dispatch spec reviewer subagent]
    Spec reviewer: PASS

    [Dispatch quality reviewer subagent]
    Quality reviewer: PASS

    Task 1 complete. Moving to Task 2...
    [Continue...]

[After all tasks]

You: All tasks complete. Using finishing-development skill...
```
```

---

## Verification

After all tasks complete, verify:

1. Read the updated skill file
2. Check all sections are present and properly formatted
3. Verify mermaid flowcharts render correctly
4. Confirm no broken references to other skills
