# OCX VS Code Extension — Agent Entry Point

This is the cross-vendor entry point for AI agents that run **outside** the
Claude Code harness (e.g., Codex CLI, other `AGENTS.md`-aware tools).

**If you are Claude Code, stop reading this file** — use `CLAUDE.md` instead.
It is the authoritative project context and is auto-loaded by the harness.
`AGENTS.md` is a thin pointer that exists only so non-Claude agents can find the
same information without a second copy to maintain.

## Where the real context lives

Read these files in order. They are the **single source of truth** — do not
rely on anything summarized in `AGENTS.md` alone.

1. **`CLAUDE.md`** (repo root) — what this extension is, current state
   (environment injection shipped), npm build/test commands, architecture,
   commit conventions, the "never push to remote" rule. Start here.
2. **`.claude/rules.md`** — the rule catalog. Scan it before planning,
   research, or any architectural decision.
3. **`.claude/rules/product-tech-strategy.md`** — golden-path technology
   choices (TypeScript, esbuild, `@vscode/test-cli`, ESLint flat config). Do
   not suggest deviations.
4. **`.claude/rules/quality-core.md`** — universal design principles (SOLID,
   DRY, KISS, YAGNI) and anti-pattern severity tiers.

## Path → subsystem rule map

When reviewing or editing code under a specific path, **read the matching
subsystem rule first** — it holds invariants and design decisions that are not
obvious from the code:

| Path | Subsystem rule |
|---|---|
| `src/**` | `.claude/rules/subsystem-extension.md` |
| `esbuild.*`, `tsconfig*.json`, `package.json` | `.claude/rules/subsystem-build.md` |
| `src/test/**`, `.vscode-test.mjs` | `.claude/rules/subsystem-tests.md` |
| `.github/workflows/**` | `.claude/rules/subsystem-ci.md` |

## Language-level quality rules

Project-independent quality guidance lives in `.claude/rules/quality-*.md` —
load the one matching the file you are reviewing:

- `quality-core.md` (universal, always applies)
- `quality-typescript.md` (TypeScript / extension source)

Adopt a new per-technology rule via the `/add-tech-specialist` workflow.

## Build & verify

- Build runner is **npm**, not go-task/cargo. List scripts with `npm run`.
- Full gate: **`npm run check`** (= lint + check-types + build). Run it after
  any implementation change.
- Tests: `npm test` (`@vscode/test-cli`; downloads + launches VS Code).
- Debug: press **F5** in VS Code (Extension Development Host).

---

# General Agent Safety (applies to any external agent)

## Non-interactive shell commands

Shell commands like `cp`, `mv`, `rm` may be aliased to `-i` (interactive) on
some systems, which would hang an agent waiting for y/n input. Always use
non-interactive flags:

```bash
cp -f source dest           # NOT: cp source dest
mv -f source dest           # NOT: mv source dest
rm -f file                  # NOT: rm file
```

Also: `npm ci` for clean installs in CI; `HOMEBREW_NO_AUTO_UPDATE=1 brew …`.

## Session hygiene

- **Never push to remote** — the human decides when to push (CI has real cost).
- All changes must be committed locally on a feature branch.
- **Never commit directly to `main`**.
- Commits follow [Conventional Commits](https://www.conventionalcommits.org/).
- Run `npm run check` after any implementation change.
- **Never commit a publish token** (`VSCE_PAT`, `OVSX_PAT`) — keep them in CI
  secrets only.
