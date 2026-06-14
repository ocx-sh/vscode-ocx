# ADR: [Decision Title]

<!--
Architecture Decision Record
Filename: artifacts/adr_NNNN_[topic].md (e.g., adr_0001_bundler_choice.md)
Owner: Architect (/architect)
Handoff to: Builder (/builder)
Related Skills: architect

Format: Based on MADR (Markdown Any Decision Records) - https://adr.github.io/madr/
Best Practices:
- Write ADRs BEFORE implementation commit
- Keep short, specific, comparable across codebase
- One decision per ADR (not groups)
- Quantify when possible (bundle size budgets, activation latency, install size)
-->

## Metadata

**Status:** Proposed | Accepted | Deprecated | Superseded
**Date:** [YYYY-MM-DD]
**Deciders:** [People involved]
**Issue:** [#issue or N/A]
**Related PRD:** [Link to PRD]
**Tech Strategy Alignment:**
- [ ] Decision follows Golden Path in `.claude/rules/product-tech-strategy.md`
- [ ] OR deviation justified in Rationale section
**Domain Tags:** [activation | bundling | testing | commands | webview | api | ci | publishing]
**Supersedes:** [adr_NNNN if applicable]
**Superseded By:** [adr_NNNN if applicable]

## Context

[Issue motivating this decision or change?]

## Decision Drivers

- [Driver 1: e.g., extension activation latency]
- [Driver 2: e.g., bundle size / install size]
- [Driver 3: e.g., VS Code API compatibility range]
- [Driver 4: e.g., maintenance cost]

## Industry Context & Research

[Tech landscape research before decision. Include trending alternatives, adoption signals, design patterns from the VS Code extension ecosystem. Reference research artifacts if available.]

**Research artifact:** [`.claude/artifacts/research_[topic].md`](./research_[topic].md) or N/A
**Trending approaches:** [Where the ecosystem is moving]
**Key insight:** [Top finding driving decision]

## Considered Options

### Option 1: [Name]

**Description:** [Brief description]

| Pros | Cons |
|------|------|
| [Pro 1] | [Con 1] |
| [Pro 2] | [Con 2] |

### Option 2: [Name]

**Description:** [Brief description]

| Pros | Cons |
|------|------|
| [Pro 1] | [Con 1] |
| [Pro 2] | [Con 2] |

### Option 3: [Name]

**Description:** [Brief description]

| Pros | Cons |
|------|------|
| [Pro 1] | [Con 1] |
| [Pro 2] | [Con 2] |

## Decision Outcome

**Chosen Option:** [Option N]

**Rationale:** [Why picked over others]

### Quantified Impact (where applicable)

| Metric | Before | After | Notes |
|--------|--------|-------|-------|
| Activation time | [X]ms | [Y]ms | [Context] |
| Bundle size (dist/extension.js) | [X]KB | [Y]KB | [Context] |
| VSIX install size | [X]MB | [Y]MB | [Context] |
| Min VS Code version | [X] | [Y] | [Context] |

### Consequences

**Positive:**
- [Consequence 1]
- [Consequence 2]

**Negative:**
- [Consequence 1]
- [Consequence 2]

**Risks:**
- [Risk 1 and mitigation]

## Technical Details

### Architecture

```
[ASCII diagram or description of architecture]
```

### API Contract

```ts
// Key interfaces, command IDs, contribution points, or contracts
```

### Data Model

```ts
// Key types and relationships (configuration, state, message shapes)
```

## Implementation Plan

1. [ ] [Step 1]
2. [ ] [Step 2]
3. [ ] [Step 3]

## Validation

- [ ] `npm run check` (lint + types + build) passes
- [ ] Integration tests pass (`npm test`)
- [ ] Activation / bundle-size budgets met

## Links

- [Related ADR 1](./adr_related.md)
- [PRD](./prd_feature.md)
- [VS Code API / external documentation]

---

## Changelog

| Date | Author | Change |
|------|--------|--------|
| [Date] | [Name] | Initial draft |
