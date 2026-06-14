# Plan: [Task Name]

<!--
Implementation Plan
Filename: .claude/state/plans/plan_[task].md
Owner: Builder (/builder) or Architect (/architect)
Handoff to: Builder (/builder), QA Engineer (/qa-engineer)
Related Skills: builder, qa-engineer
-->

## Status

<!--
Status block — keep in the first ~20 lines so tooling can grep it.
- **Plan:** plan_[task]
- **Active phase:** 1 — [first phase title]
- **Step:** plan-approved
- **Last update:** [YYYY-MM-DD] (initialized)
-->

- **Plan:** plan_[task]
- **Active phase:** 1 — [first phase title]
- **Step:** plan-approved
- **Last update:** [YYYY-MM-DD] (initialized)

---

## Overview

**Status:** Draft | Approved | In Progress | Complete
**Author:** [Name]
**Date:** [YYYY-MM-DD]
**Issue:** [#issue or N/A]
**Related PRD:** [Link to PRD]
**Related ADR:** [Link to ADR]

## Objective

[What plan accomplishes, concise]

## Scope

### In Scope

- [Item 1]
- [Item 2]

### Out of Scope

- [Item 1]
- [Item 2]

## Research

**Research artifact:** [`.claude/artifacts/research_[topic].md`](./research_[topic].md) or N/A

[Tech landscape research summary. Trending tools, design patterns, ecosystem signals informing the plan? Alternatives considered from current adoption trends?]

## Technical Approach

### Architecture Changes

```
[Diagram or description of architectural changes]
```

### Key Decisions

| Decision | Rationale |
|----------|-----------|
| [Decision 1] | [Why] |
| [Decision 2] | [Why] |

## Implementation Steps

> **Contract-First TDD**: Every feature follows Stub → Verify → Specify → Implement → Review.
> Tests written from the design record *before* implementation. Validate the contract — not implementation details.

### Phase 1: Stubs

Make type signatures, interfaces, function shells, command registrations. Bodies `throw new Error("not implemented")`. Goal: set the public API surface + architectural shape, no business logic.

- [ ] **Step 1.1:** [Stub description — types, interfaces, function signatures, command IDs]
  - Files: `src/path/to/file.ts`
  - Public API: [Signatures + types introduced]

- [ ] **Step 1.2:** [Stub description]
  - Files: `src/path/to/file.ts`
  - Public API: [Signatures + types introduced]

Gate: `npm run check-types` passes.

### Phase 2: Architecture Review

Review stubs against the design record (`worker-reviewer`, focus: `spec-compliance`, phase: `post-stub`). Verify:
- Type signatures match the documented API contract
- Module boundaries align with the architecture section above
- Error types cover all documented failure modes
- No missing public surface vs design

Gate: Architecture review passes before proceeding. *Optional for features touching ≤3 files.*

### Phase 3: Specification Tests

Write tests from the design record, NOT from stubs. Tests encode expected behavior, edge cases, acceptance criteria above. Tests must fail against stubs.

- [ ] **Step 3.1:** Unit / integration tests (from design record component contracts)
  - Files: `src/test/**/*.test.ts` (run via `@vscode/test-cli`)
  - Cases: [Happy path, error cases, edge cases from design]

- [ ] **Step 3.2:** Activation / command acceptance tests (from design record UX)
  - Files: `src/test/**/*.test.ts`
  - Scenarios: [User-facing behaviors — command palette, settings, activation events]

Gate: Tests compile + fail (behavior not yet implemented).

### Phase 4: Implementation

Fill stub bodies so all spec tests pass. No new tests needed — if needed, the design record is incomplete (update it).

- [ ] **Step 4.1:** [Implementation description]
  - Files: `src/path/to/file.ts`
  - Details: [Additional context]

- [ ] **Step 4.2:** [Implementation description]
  - Files: `src/path/to/file.ts`
  - Details: [Additional context]

Gate: All tests pass (`npm test`). `npm run check` succeeds.

### Phase 5: Review & Documentation

- [ ] **Step 5.1:** Spec compliance review (design record ↔ tests ↔ implementation)
- [ ] **Step 5.2:** Code quality review (lint, type-check, rule compliance)
- [ ] **Step 5.3:** Documentation updates
  - Update: [README, CHANGELOG, package.json contributes, files/sections]

## Files to Modify

| File | Action | Description |
|------|--------|-------------|
| `src/path/to/file.ts` | Create | [Purpose] |
| `src/path/to/existing.ts` | Modify | [Changes] |
| `package.json` | Modify | [contributes / activationEvents / scripts] |

## Dependencies

### Code Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| [package] | [version] | [why needed — runtime dep vs devDependency] |

### Tooling / Service Dependencies

| Item | Status | Notes |
|------|--------|-------|
| [esbuild / @vscode/test-cli / etc.] | [Available/Needed] | [Notes] |

## Testing Strategy

> Tests = executable spec. Written from the design record in Phase 3, before implementation in Phase 4. Each test case traces back to a requirement here.

### Unit / Integration Tests (from component contracts)

| Component | Behavior | Expected | Edge Cases |
|-----------|----------|----------|------------|
| [Component 1] | [What it should do] | [Expected result] | [Boundary conditions] |
| [Component 2] | [What it should do] | [Expected result] | [Boundary conditions] |

### Acceptance Tests (from user experience)

| User Action | Expected Outcome | Error Cases |
|-------------|------------------|-------------|
| [Run command from palette] | [What user sees] | [Error scenarios] |
| [Change setting] | [What happens] | [Error scenarios] |

### Manual Testing

- [ ] Launch the Extension Development Host (F5) and exercise [feature]
- [ ] [Test case 2]

## Rollback Plan

1. [Step to revert if issues]
2. [Step to restore previous state]
3. [Verification steps]

## Risks

| Risk | Mitigation |
|------|------------|
| [Risk 1] | [How to handle] |
| [Risk 2] | [How to handle] |

## Checklist

### Before Starting

- [ ] PRD/ADR approved
- [ ] Dependencies available
- [ ] Branch created from main

### Before PR

- [ ] All tests passing (`npm test`)
- [ ] No lint or type errors (`npm run check`)
- [ ] Documentation updated
- [ ] Self-review complete

### Before Merge

- [ ] Code review approved
- [ ] QA sign-off
- [ ] No merge conflicts

## Notes

[Extra context, considerations, comments]

---

## Progress Log

| Date | Update |
|------|--------|
| [Date] | [What was done] |
