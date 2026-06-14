# Conventional Commits v1.0.0 — Cheat Sheet

Reference for the `/commit` skill. Full spec: https://www.conventionalcommits.org/en/v1.0.0/

## Structure

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

- Blank line between subject and body.
- Blank line between body and footers.

## Types (extension usage)

| Type | Meaning | Changelog? |
|---|---|---|
| `feat` | New feature or capability | Yes (MINOR) |
| `fix` | Bug fix | Yes (PATCH) |
| `perf` | Perf improvement, behavior unchanged | Yes |
| `refactor` | Structure change, behavior unchanged | Yes |
| `docs` | Docs only | Yes |
| `test` | Tests only | Yes |
| `build` | Build system, deps, `package.json`, esbuild config | Yes |
| `ci` | CI config (GitHub Actions workflows) | Yes |
| `chore` | **AI/tooling files, `.claude/`, CLAUDE.md, skills, rules, hooks** | **No** |
| `style` | Formatting only (prefer skip — Prettier handles) | No |

Rule: `chore:` for anything under `.claude/` or AI-config files so they stay out of the user changelog.

## Scope

Optional noun for the area touched. Examples:

- `feat(commands): add ocx.refresh command`
- `fix(activation): defer registry client init to first use`
- `build(esbuild): mark vscode external in cjs bundle`
- `chore(claude): tighten builder skill description`

Add a scope only when it narrows the change. Skip it for cross-cutting work.

## Description

- Imperative mood: `add`, `fix`, `remove` — not `added`, `fixes`, `removing`.
- Lowercase first letter.
- No trailing period.
- ≤72 chars for the full subject line.

Bad: `Added a new command to the palette.`
Good: `feat(commands): add hello-world command`

## Body (optional)

Explain **why**, not what — the diff shows what. Include a body only when the reason is non-obvious (hidden constraint, subtle invariant, workaround for a specific bug, context a future reader would miss).

Wrap at ~80 chars. Plain prose; no bullet soup unless listing discrete items.

## Footers (optional)

Format: `Token: value` or `Token #reference`. Tokens use hyphens, not spaces.

Common footers:

- `BREAKING CHANGE: <description>` — mandatory for breaking changes (even with `!` in the subject). The only footer where spaces are allowed in the token.
- `Refs: #123` — reference an issue without closing.
- `Closes: #123` — close an issue when the commit lands on the default branch.

**Never use `Co-Authored-By`** in this repo.

## Breaking Changes

Two signals, used together:

1. `!` before the colon: `feat(api)!: rename ocx.run command to ocx.execute`
2. Footer: `BREAKING CHANGE: the ocx.run command id is now ocx.execute; update keybindings.`

Both appear. `!` for fast scanning; the footer for detail.

## Worked Examples

### Simple feature
```
feat(commands): add hello-world command
```

### Bug fix with context
```
fix(activation): register status bar item in subscriptions

The status bar item was created on activate() but never pushed to
context.subscriptions, so it leaked across Extension Development Host
reloads and lingered after deactivate().
```

### Breaking change
```
feat(config)!: rename ocx.endpoint to ocx.registry.url

BREAKING CHANGE: the `ocx.endpoint` setting is renamed to
`ocx.registry.url`. Existing settings must be migrated; the old key is
no longer read.
```

### AI config change (chore, no changelog entry)
```
chore(claude): add /commit skill with PR-prompt memory
```

## Common Mistakes

- **Title case description** — `feat: Add foo` should be `feat: add foo`
- **Past tense** — `fix: fixed the bug` should be `fix: fix the bug`
- **Explain what not why** — the diff shows what; the body is for why
- **Bullet body for a single-line change** — prose is fine; bullets are noise
- **Scope duplicating type** — `feat(feature):` adds nothing
- **Multiple concerns in one commit** — outside working-phase bundling, split; one concern per commit
