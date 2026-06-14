# Research: State-of-the-Art AI Assistant Config for Repos (2025/2026)

<!--
Technology Landscape Research
Filename: .claude/artifacts/research_ai_config_sota.md
Owner: Researcher
Handoff to: Architect (/architect), config maintainers
Purpose: Persist the SOTA shape of in-repo AI assistant config (Claude Code +
the vendor-neutral AGENTS.md standard) so the .claude/ layout traces to a
cited baseline. Artifacts decay — re-verify before trusting findings.
-->

## Metadata

**Date:** 2026-06-14
**Domain:** ai-tooling / developer-experience / repo-config
**Triggered by:** Building the `.claude/` config for the OCX VS Code extension
**Expires:** ~2026-12 (re-verify AGENTS.md adoption, Claude Code mechanisms)

## Direct Answer

The 2025/2026 baseline is **Claude Code's `.claude/` layout** — a small
`CLAUDE.md` (always-on facts), **path-scoped rules**, **agents**
(`.claude/agents/*.md` with `name`/`description`/`tools`/`model` frontmatter),
**Skills** (`.claude/skills/<name>/SKILL.md`, model-invoked via description
match, progressive disclosure), and **hooks** (`settings.json`, deterministic
enforcement) — paired with **`AGENTS.md`**, the emerging vendor-neutral standard
(Aug 2025) supported across Claude Code, Codex, Cursor, and Copilot. The common
pattern is **CLAUDE.md as the primary file + a thin AGENTS.md pointer** (or a
symlink). Scope minimally, keep the primary file small, restrict agent tools,
and grow incrementally.

## Technology Landscape

### Established (proven, widely accepted)

| Tool/Pattern | Status | Notes |
|---|---|---|
| **`CLAUDE.md`** | Standard for Claude Code | Always-on facts, not procedures; keep <200-300 lines |
| **Path-scoped rules** | Standard | Knowledge that loads only when editing matching paths |
| **Agents** (`.claude/agents/*.md`) | Standard | Frontmatter `name`/`description`/`tools`/`model`; isolated specialists with their own context |
| **Skills** (`.claude/skills/<name>/SKILL.md`) | Standard | Model-invoked via description match; progressive disclosure (load detail on demand) |
| **Hooks** (`settings.json`) | Standard | Deterministic, non-LLM enforcement (gates, validators, routers) |
| **`settings.json` permissions** | Standard | Allow/deny lists scope what the agent may do |

### Trending (gaining momentum)

| Tool/Pattern | Adoption signal | Key benefit | Relevance |
|---|---|---|---|
| **`AGENTS.md`** standard | Introduced Aug 2025; cross-vendor | Single source of truth for non-Claude tools | Vendor-neutral; supported by Claude Code, Codex, Cursor, Copilot, etc.; hierarchical per-directory |
| CLAUDE.md primary + AGENTS.md pointer | Common pattern | Avoids a second copy to maintain | A symlink or thin pointer keeps one source of truth |

### Cross-tool equivalents (for awareness)

| Tool | Config location | Notes |
|---|---|---|
| Cursor | `.cursor/rules/*.mdc` | Per-rule markdown with metadata |
| GitHub Copilot | `.github/copilot-instructions.md` + `.github/instructions/*.instructions.md` | Per-instruction files use glob frontmatter |
| Windsurf | `.windsurf/rules/` | Rule directory |

## Design Patterns Worth Considering

- **When to use each mechanism:**
  - `CLAUDE.md` / `AGENTS.md` → always-on facts.
  - **Rules** → path-scoped knowledge (loads on file match).
  - **Skills** → multi-step procedures loaded on demand.
  - **Agents** → isolated specialists with their own context window.
- **Keep the primary file small** — facts, not procedures; push detail into
  rules/skills so the always-loaded budget stays low.
- **Restrict agent tools** — grant each agent only the tools it needs.
- **Scope minimally, grow incrementally** — start with a thin config and add
  rules/skills/agents as real needs appear.
- **One source of truth** — CLAUDE.md authoritative; AGENTS.md is a pointer (or
  symlink), not a divergent copy.

## Key Findings

1. **Claude Code `.claude/` is the SOTA in-repo layout**: small `CLAUDE.md`,
   path-scoped rules, agents (frontmatter `name`/`description`/`tools`/`model`),
   Skills (model-invoked, progressive disclosure), hooks, and `settings.json`
   permissions. (code.claude.com/docs — skills, sub-agents)
2. **`AGENTS.md` is the emerging vendor-neutral standard** (Aug 2025), supported
   by Claude Code, Codex, Cursor, Copilot and others; hierarchical per-directory;
   meant as a single source of truth. (agents.md write-ups: tessl.io, infoq.com, remio.ai)
3. **The common pattern is CLAUDE.md primary + AGENTS.md pointer** (or symlink),
   keeping one maintained source. (deployhq.com AI config files guide)
4. **Skills use progressive disclosure** — the description is the trigger; detail
   loads only when invoked, keeping context lean. (anthropic.com "Agent Skills")
5. **Other tools have parallel mechanisms** — Cursor `.cursor/rules/*.mdc`,
   Copilot `.github/copilot-instructions.md` + `.github/instructions/*.instructions.md`
   (glob frontmatter), Windsurf `.windsurf/rules/`.
6. **Discipline matters more than volume** — scope minimally, keep the primary
   file small, restrict agent tools, grow incrementally.

## Recommendation

Adopt the Claude Code `.claude/` layout as the authoritative config: small
`CLAUDE.md`, path-scoped rules, restricted-tool agents, model-invoked Skills,
and deterministic hooks. Add a **thin `AGENTS.md` pointer** so non-Claude tools
(Codex, Cursor, Copilot) read the same facts without a second copy. Keep the
primary file lean and grow the config incrementally.

## Sources

| Source | Type | Relevance |
|---|---|---|
| https://code.claude.com/docs (Agent Skills) | Docs | Skill layout, model invocation, progressive disclosure |
| https://code.claude.com/docs (Subagents) | Docs | Agent frontmatter (name/description/tools/model) |
| https://agents.md (and tessl.io, infoq.com, remio.ai write-ups) | Standard/Blog | AGENTS.md vendor-neutral standard, hierarchical files |
| https://www.deployhq.com (AI config files guide) | Blog | CLAUDE.md + AGENTS.md patterns, cross-tool comparison |
| https://www.anthropic.com/engineering (Agent Skills) | Blog | When/why of Skills, progressive disclosure |
