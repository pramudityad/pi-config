---
name: ecc-pr-ready
description: Pre-PR checklist to verify code is ready for review. Runs linting, tests, type checking, and generates a summary. Triggers on phrases like "ready for PR", "pre-PR check", "is this ready to merge", "review readiness".
---

# PR Ready Check

Comprehensive pre-PR validation for CloudEats microservices.

## Usage

### Quick Check

```bash
~/.pi/agent/skills/ecc-pr-ready/check.sh
```

### Full Check (with test coverage)

```bash
~/.pi/agent/skills/ecc-pr-ready/check.sh --full
```

### Generate PR Description

```bash
~/.pi/agent/skills/ecc-pr-ready/check.sh --pr
```

## Checks Performed

| Check | Command | Required |
|-------|---------|----------|
| 🔍 Lint | `npm run lint` | ✅ |
| 📝 Type Check | `tsc --noEmit` | ✅ |
| 🧪 Unit Tests | `npm test` | ✅ |
| 🔒 Security Audit | `npm audit` | ⚠️ |
| 📦 Build | `npm run build` | ✅ |
| 🌿 Git Status | clean working tree | ✅ |

## Output

```
## PR Readiness Check

### Ticket: DP-7180
### Branch: DP-7180-field-rejection

| Check | Status | Details |
|-------|--------|---------|
| 🔍 Lint | ✅ PASS | No issues |
| 📝 Types | ✅ PASS | No errors |
| 🧪 Tests | ✅ PASS | 42/42 passed |
| 🔒 Security | ⚠️ WARN | 1 moderate (dev dep) |
| 📦 Build | ✅ PASS | 2.3s |
| 🌿 Git | ✅ PASS | Clean |

### Ready for PR: ✅ YES

### Changed Files (5)
- src/services/rejection.service.ts
- src/controllers/rejection.controller.ts
- src/routes/rejection.routes.ts
- src/types/rejection.types.ts
- tests/rejection.test.ts

### Suggested PR Description
---
**Ticket:** DP-7180
**Type:** Feature

## Changes
- Add field-level rejection endpoint
- Add batch rejection support
- Add rejection reason validation

## Testing
- [x] Unit tests added
- [x] Manual testing in dev
- [ ] E2E tests (pending)

## Checklist
- [x] No lint errors
- [x] Types check passes
- [x] All tests pass
- [x] No security vulnerabilities
---
```

## Configuration

Per-project `.prrc.json`:

```json
{
  "requiredChecks": ["lint", "typecheck", "test", "build"],
  "optionalChecks": ["audit", "coverage"],
  "minCoverage": 80,
  "ticketPattern": "DP-\\d+"
}
```

## Integration

After passing checks, use:
- `requesting-code-review` skill to request review
- `clickup` skill to update ticket status
- `api-evidence` skill to capture test evidence
