# Design Docs & Implementation Plans

**Purpose:** Architecture decisions, design documents, and step-by-step implementation plans for major features of the pi-config project.

7 files — 3 design docs (unpaired) and 4 design+plan pairs.

## File Conventions

- **Naming:** `<YYYY-MM-DD>-<topic>-design.md` for design docs, `<YYYY-MM-DD>-<topic>.md` for implementation plans
- **Format:** Markdown with sections for Context, Decision, Implementation Plan
- **Design doc pairs:** When a feature has both a design doc and an implementation plan, they share the same date prefix

## Document Inventory

| File | Topic |
|------|-------|
| `2026-04-01-subagent-development-improvements-design.md` | Subagent improvements — design |
| `2026-04-01-subagent-development-improvements.md` | Subagent improvements — implementation plan |
| `2026-04-14-browser-use-skill-design.md` | browser-use skill — design only |
| `2026-06-09-render-diagram-mermaid-excalidraw-design.md` | Mermaid/Excalidraw render — design |
| `2026-06-09-render-diagram-mermaid-excalidraw.md` | Mermaid/Excalidraw render — implementation plan |
| `2026-06-09-sdk-subagent-orchestrator-design.md` | SDK subagent orchestrator — design (1000+ lines) |
| `2026-06-09-sdk-subagent-orchestrator.md` | SDK subagent orchestrator — implementation plan |

## Architecture Patterns

- **Design-first:** Major features start with a design doc before any code is written
- **Design sections typically include:** Context / Problem / Proposed Solution / Alternatives Considered / File-by-file breakdown
- **Implementation plan sections:** Prerequisites / Steps (numbered) / Verification Criteria / Rollout Plan
- **Traceability:** Implementation plans reference the design doc by filename

## Do's and Don'ts

- **Do** write the design doc first before starting implementation
- **Do** keep design docs and plans in a single flat directory — no subdirectories
- **Do** include a file-by-file breakdown in implementation plans
- **Do** reference specific line numbers or functions from the codebase where relevant
- **Don't** include code snippets longer than 20 lines — link to files instead
- **Don't** nest doc directories — `docs/plans/` is flat intentionally
- **Don't** store session logs or scratch data here — those go in `sessions/` and `.pi/`

## Review Path

When reading a feature:

1. Start with the design doc (`*-design.md`) for context and decisions
2. Read the implementation plan (`-design.md` counterpart or standalone `.md`) for step-by-step
3. Check if the code matches the design before making changes
