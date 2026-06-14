---
paths:
  - ".github/**"
  - "CHANGELOG.md"
---

# Git & Commit Workflow

Branch-and-commit hygiene for the OCX VS Code extension. Referenced on demand by commit/finalize skills and auto-loaded when editing CI config or the changelog.

## Branching & Pushing

- **Never commit on `main`.** If on `main`, stop and create/switch to a feature branch first.
- **Never push automatically.** Push triggers CI (real cost) and publishes intent — the **human** decides when to push. No skill, agent, or automation pushes on its own.
- **Never use hook-skipping flags** (`--no-verify`, `--no-gpg-sign`). A failing hook means the commit did not happen — fix the root cause and make a new commit (don't `--amend`, which would rewrite the *previous* commit).
- **No `Co-Authored-By`** trailers.

## Conventional Commits

Format: `<type>[optional scope]: <description>`

| Type | Use for |
|------|---------|
| `feat` | New user-facing capability (command, view, language feature) |
| `fix` | Bug fix in shipped behavior |
| `refactor` | Structure change, no behavior change |
| `perf` | Performance improvement |
| `test` | Tests only |
| `docs` | Documentation only |
| `build` | Build system / bundler / packaging (esbuild, tsconfig, .vscodeignore) |
| `ci` | GitHub Actions / CI config |
| `chore` | Tooling, deps, **AI config** (`.claude/`, `CLAUDE.md`, rules, skills, agents) |
| `style` | Formatting only (no logic change) |

Rules:

- Imperative mood, lowercase description, no trailing period, subject ≤72 chars.
- Body explains **why**, not what — only when non-obvious.
- **`chore:` for AI-config and tooling changes** (rules, skills, agents, hooks, `.claude/`) — keeps them out of any user-facing changelog.
- Breaking change: `!` before the colon **and** a `BREAKING CHANGE:` footer.

## Changelog

`CHANGELOG.md` reflects user-facing changes (Marketplace/Open VSX users read it). `feat`/`fix`/`perf` land there; `chore`/`ci`/`build`/`test`/`docs`/`style` generally do not. AI-config (`chore:`) changes never appear in the changelog.

## Land-Ready Checklist

Before a branch merges to `main`:

- [ ] Rebased on current `main` (no merge commits in `main..HEAD`)
- [ ] Every commit has a Conventional Commits subject, one concern each
- [ ] Lint + `tsc --noEmit` + tests pass locally (`npm run lint`, `npm run check-types`, `npm test`)
- [ ] `CHANGELOG.md` updated for any user-facing change

## AI Config Changes

Edits to `.claude/**`, `CLAUDE.md`, rules, skills, or agents are **`chore:`** commits. When adding/removing/renaming a rule, update `.claude/rules.md` in the **same commit** (see `meta-ai-config.md`).
