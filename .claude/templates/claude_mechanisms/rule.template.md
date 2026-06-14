---
paths:
  - "src/**/*.ts"
  - "**/*.test.ts"
# Add the globs that scope this rule. A rule auto-loads ONLY when an edited
# file matches one of these globs. Omit `paths:` entirely for an always-on
# rule (loaded for every file in the project) — use that sparingly, it costs
# tokens on every turn.
---

# [Rule Name]

<!--
NOTE: Rules support PATH-SCOPED loading via the `paths:` frontmatter above.
A path-scoped rule fires only when an edited file matches one of its globs.
This is the live behaviour — older docs that claim "no path-based loading"
are stale. Rules with no `paths:` key load for every file.

Place this file in: .claude/rules/[rule-name].md
Register it in the catalog: .claude/rules.md (same commit).
Keep rules concise to minimise token usage.
-->

## Overview

[Brief description of what this rule covers and why it matters]

## Standards

### [Category 1]

1. [Standard 1]
2. [Standard 2]
3. [Standard 3]

### [Category 2]

1. [Standard 1]
2. [Standard 2]

## Best Practices

- [Practice 1]
- [Practice 2]
- [Practice 3]

## Tooling

| Tool | Purpose |
|------|---------|
| [Tool 1] | [Description] |
| [Tool 2] | [Description] |

## Examples

### Good

```ts
// Example of correct usage
```

### Bad

```ts
// Example of what to avoid
```

## Checklist

- [ ] [Verification item 1]
- [ ] [Verification item 2]
- [ ] [Verification item 3]
