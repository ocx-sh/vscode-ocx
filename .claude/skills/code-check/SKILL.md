---
name: code-check
description: Use for code review, quality audits, SOLID/DRY consistency checks, pattern audits across the VS Code extension codebase, lint/type-check, or verifying anti-pattern compliance across a scope. Trigger: /code-check.
user-invocable: true
argument-hint: "scope: all | src/<dir> | path/to/dir"
triggers:
  - "code quality check"
  - "audit the code"
  - "quality audit"
  - "anti-pattern scan"
  - "solid check"
---

# Codebase Health Auditor

Role: audit the OCX VS Code extension for Clean Code, SOLID, DRY, pattern consistency, and tooling compliance.

## Workflow

1. **Gates** — run the automated checks first: `npm run lint` (ESLint flat config), `npm run check-types` (tsc). Capture failures as findings.
2. **Swarm** — launch parallel `worker-reviewer` agents per audit dimension over the scope.
3. **Audit** — SOLID, DRY, smells, consistency, extension-specific patterns, rule freshness.
4. **Report** — prioritized findings with file:line refs + remediation.

## Audit Dimensions

- **SOLID** — one responsibility per module, narrow interfaces, dependency inversion
- **DRY** — knowledge duplication (MUST fix) vs incidental similarity (evaluate)
- **Smells** — long functions, god objects, primitive obsession, feature envy, message chains
- **Consistency** — error handling, async/await, naming, import strategy match existing patterns
- **Extension-specific** — disposables registered in `context.subscriptions`; `activate()` stays cheap; `package.json` `contributes` IDs match code; `vscode` external in the bundle; webview CSP present
- **Rule freshness** — verify `tech-*.md` / subsystem rules still match current code

## Relevant Rules (load for the scope under audit)

- `.claude/rules/quality-typescript.md` — TS strict baseline, anti-patterns, tooling
- `.claude/rules/tech-vscode-api.md` — disposable ownership, activation discipline, contributes parity (if present)
- `.claude/rules/tech-esbuild.md` — bundle contract (if present)
- `.claude/rules.md` — full catalog for cross-cutting concerns

## Tool Preferences

- **npm scripts** — `npm run lint`, `npm run check-types`, `npm run check` for the full gate
- **Grep/Glob first** — verify patterns before flagging
- **ESLint** — rely on the flat config; flag rule-disable comments that lack justification

## Output Format

```markdown
## Codebase Health Report

### Executive Summary
**Health Score**: [A/B/C/D/F]
**Critical Issues**: [count]
**Lint/Type Gate**: [pass/fail]

### Pattern Violations
| Pattern | File:Line | Description | Remediation |

### SOLID Violations
| Principle | File:Line | Description | Remediation |

### Rule Staleness
| Rule File | Stale Reference | Current State |
```

## Constraints

- NO flagging incidental duplication as critical
- NO recommending public API/contributes breakage without a migration note
- ALWAYS provide specific file:line refs + concrete remediation

## Handoff

- To Builder — with specific fixes + refactoring items
- To Architect — for systemic architectural issues

$ARGUMENTS
