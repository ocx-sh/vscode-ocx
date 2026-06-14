---
paths:
  - .claude/**
---

# AI Configuration Meta-Rule

Governs how `.claude/` artifacts (rules, skills, agents, hooks) are maintained for the OCX VS Code extension. Loads when editing any `.claude/` file.

## Three Activation Layers

| Layer | Activation | Use for | Example |
|---|---|---|---|
| **Rule** (`.claude/rules/*.md`) | `paths:` glob — fires when an edited file matches | Standards/context needed *while writing* a file | `quality-typescript.md` on `**/*.ts` |
| **Skill** (`.claude/skills/<name>/SKILL.md`) | LLM matches `description` against the task | Workflow + criteria for a task topic | `add-tech-specialist` for "add a new tech rule" |
| **Catalog** (`.claude/rules.md`) | Read on demand during planning; pointed to from `CLAUDE.md` | Discover what rules exist *before* a file is open | — |

Path-scoped rules do not fire during plan/research/architecture (no file open yet). The catalog (`.claude/rules.md`) closes that gap. **Any `.claude/rules/` change must be reflected in the catalog in the same commit.**

### Current Global Rules (no `paths:` frontmatter)

Exactly **three** rules under `.claude/rules/` have no `paths:` frontmatter and load every session. They must also appear in the `rules.md` "Globals" footer. Any change to this set updates both places.

1. `quality-core.md` — universal code quality
2. `product-tech-strategy.md` — tech golden paths
3. `product-context.md` — extension vision/scope

`CLAUDE.md` and `.claude/rules.md` also always reach Claude, but by direct load / `@`-import, not via the path-scope layer — they are not counted as global *rules*. `meta-ai-config.md` is path-scoped to `.claude/**`, so it is not a global rule either.

## Context Budget

Every rule, skill description, and `CLAUDE.md` line competes for the same context window. Bloat = ignored instructions.

| Artifact | Budget |
|----------|--------|
| CLAUDE.md | <200 lines (loads every request) |
| Rules (global or scoped) | <200 lines each |
| Skill body (SKILL.md) | <500 lines (loads only when invoked) |
| Hooks | Zero context cost (external scripts) |
| Subagents | Isolated context (no impact on main session) |

**Where does an instruction belong?**

```
Must Claude know it every session?
├─ Yes → file/directory-specific? → .claude/rules/ with paths: (else CLAUDE.md, only if omission causes mistakes)
└─ No → manual side-effects → Skill (disable-model-invocation: true)
        auto-triggered → Skill with a good description
        pure deterministic automation → Hook
```

## Naming Conventions

| Artifact | Convention |
|----------|-----------|
| Rules | `quality-*` / `subsystem-*` / `tech-*` / `workflow-*` / `product-*` / `meta-*` / `arch-*`; scoped via `paths:` frontmatter |
| Agents | `.claude/agents/worker-<name>.md` (general roles), `.claude/agents/specialist-<name>.md` (per-technology) |
| Skills | `.claude/skills/<name>/SKILL.md` — **flat layout, no category subdirectories** (nesting breaks slash-command discovery) |

### Rules (`.claude/rules/*.md`)

- `paths:` frontmatter for scoped rules; omit for global (only the three listed above).
- <200 lines. Split by domain if longer.
- Structure: types → invariants → gotchas → cross-refs.
- **Shareable `quality-*.md` rules must be project-independent** — no references to OCX-extension specifics. Extension-specific patterns live in `arch-principles.md` / `subsystem-*.md`. They use broad globs (e.g. `**/*.ts`) so they activate regardless of layout.

### Skills (`.claude/skills/<name>/SKILL.md`)

- `description` is the #1 discovery factor — front-load discriminating keywords; max 1024 chars.
- `disable-model-invocation: true` for action skills with side effects (commit, publish).
- `argument-hint` is a quoted string; `allowed-tools` is not supported in frontmatter.
- Progressive disclosure: SKILL.md <500 lines; move detail to reference files. `context: fork` to isolate.

### Agents (`.claude/agents/*.md`)

- `model`: haiku (exploration), sonnet (implementation/review), opus (architecture).
- `tools`: the minimum the role needs.
- Keep concise; agents inherit project rules. Point at `.claude/rules.md`, then inline a short (≤5) "Always Apply" anchor list, each tagged with its source rule file.

### Hooks (`.claude/hooks/*.py`)

- Zero context cost; deterministic enforcement only.
- Exit 0 = proceed, exit 2 = block + feed stderr to Claude.
- Python (stdlib), invoked via `uv run`. `PreToolUse` for blocking, `PostToolUse` for logging/reminders (never exit non-zero there).

## Per-Technology Specialist Trio

For each significant technology, use a **trio** so deep knowledge is discoverable in every mode:

1. **Rule** `tech-<name>.md` — path-scoped, deep, source-cited API knowledge (auto-loads when editing relevant files).
2. **Agent** `specialist-<name>.md` — a subagent that carries that expertise into delegated tasks.
3. **Skill** (optional) — a slash command when there's a repeatable workflow.

Current trios: `vscode-api` (rule `tech-vscode-api.md` + agent `specialist-vscode-api`), `esbuild` (rule `tech-esbuild.md` + agent `specialist-esbuild`). The **`/add-tech-specialist`** skill scaffolds new trios (e.g. for Solr, when the extension grows to query a Solr index).

## Research-Informed Changes

**Every AI-config edit should be research-informed**, not authored from memory. For non-trivial changes, spawn explorer/researcher workers (per-tech-axis, domain-axis, community-axis). Persist substantial findings to **`.claude/artifacts/research_<topic>.md`** so future sessions reuse them. ADRs live in `.claude/artifacts/adr_*.md`.

## Catalog Parity Rule

`.claude/rules.md` is the authoritative catalog. On **every** rule add/remove/rename or `paths:` change, update the catalog in the **same commit**: add/remove rows in the relevant tables ("By concern", "By language", "By subsystem", "By auto-load path"), and keep the "Globals" footer in sync with the three-global invariant.

## Anti-Patterns

1. Global rule >200 lines — same problem as a bloated CLAUDE.md.
2. Rules matching `src/**/*` too broadly — effectively a second CLAUDE.md.
3. Duplicate content across CLAUDE.md / rules / skills — single source of truth.
4. Verbose SKILL.md without progressive disclosure.
5. Action skill without `disable-model-invocation`.
6. Dead glob patterns — rules that silently never fire after a rename.
7. `quality-*.md` containing project-specific content — keep them shareable.
8. **Catalog drift** — changing `.claude/rules/` without updating `.claude/rules.md`.
9. Category subdirectories under `.claude/skills/` — break slash-command discovery.
10. More than three global rules — re-check the invariant before finishing.

## Consistency Checklist

When editing any `.claude/` artifact:

- [ ] Frontmatter follows the convention for its type
- [ ] Cross-refs point to existing files
- [ ] Exactly three global rules (no `paths:`): `quality-core.md`, `product-tech-strategy.md`, `product-context.md`
- [ ] `.claude/rules.md` catalog updated in the same change
- [ ] CLAUDE.md (if present) stays under 200 lines
