---
name: add-tech-specialist
description: Use when the extension adopts a new technology (a library, framework, protocol, or service — e.g. Solr, a language server, a webview UI framework) and you want reusable per-technology expertise. Generates a path-scoped rule + a specialist agent (+ optional skill) so future tasks get current, project-specific guidance on that tech. Trigger: /add-tech-specialist.
user-invocable: true
disable-model-invocation: false
argument-hint: "technology-name"
triggers:
  - "add a tech specialist"
  - "create a specialist for"
  - "per-technology analysis"
  - "research this technology and make a rule"
  - "onboard a new library"
---

# /add-tech-specialist — Per-Technology Specialist Generator

Meta-skill. Turns "we now use technology X" into reusable assets: a path-scoped
rule capturing how X is used in this extension, a specialist agent that carries
that rule and verifies current API, optionally a workflow skill, and a catalog
entry so everything is discoverable. This is what makes per-technology analysis
(e.g. for Solr) repeatable instead of one-off.

The argument is the technology name, e.g. `/add-tech-specialist solr`. Derive a
slug `<name>` = lowercase, hyphens only (e.g. `solr`, `language-server`,
`react-webview`).

## Inputs

- `$ARGUMENTS` — the technology name. If missing or ambiguous, ask the user for
  the exact technology and how the extension uses it (runtime dep, build tool,
  external service, webview UI, protocol) before proceeding.

## Workflow

### 1. Research the technology (web + Context7)

Goal: a current, sourced understanding — do NOT rely on training memory.

- **Context7 MCP** — `mcp__context7__resolve-library-id` then `get-library-docs` for the library's current API shape and version.
- **WebSearch / WebFetch** — official docs, the project's README/changelog, and recent (date-stamped) ecosystem signals. Capture version numbers and the date you verified them.
- **Grep/Glob/Read** — find where (or whether) the extension already uses this tech in `src/`, `package.json`, and build config, so the rule reflects actual usage, not generic advice.
- Note: API knowledge decays. Record the verification date in the rule's Sources table.

Optionally persist findings to `.claude/artifacts/research_<name>.md` using
`.claude/templates/artifacts/research.template.md` — useful when the research is
substantial or feeds an ADR.

### 2. Write the path-scoped rule

Create `.claude/rules/tech-<name>.md` from the stencil
`.claude/templates/tech_specialist/rule.template.md`.

- Set the `paths:` frontmatter to globs matching where this tech is actually used
  (broad like `src/**/*.ts` for a pervasive API; narrow like `**/esbuild.*` or
  `src/**/*solr*.ts` for a localized integration). The rule then auto-loads only
  on matching edits.
- Fill: **Overview** (what it is, version targeted, verification date),
  **Core model**, **Invariants**, **Gotchas**, **Best practices**, **Sources**
  (with dates).
- Keep it concise — it loads into context on every matching edit.

### 3. Write the specialist agent

Create `.claude/agents/specialist-<name>.md` from the stencil
`.claude/templates/tech_specialist/agent.template.md`.

- Frontmatter: `name: specialist-<name>`, `model: sonnet`, `tools: Read, Glob, Grep, WebSearch, WebFetch`.
- Body: Focus / Rule Context / Tool Preferences / Output Format / Constraints / On Completion.
- The agent must state it **carries `.claude/rules/tech-<name>.md`** as its
  authoritative context and verifies version-sensitive claims via Context7 /
  official docs before answering.
- Mirror the exemplars `specialist-vscode-api.md` and `specialist-esbuild.md`.

### 4. (Optional) Add a workflow skill

Only if the tech has a recurring, multi-step workflow worth automating (e.g.
"run a Solr query and validate the schema", "regenerate the language-server
protocol types"). If so, create `.claude/skills/<name>-<verb>/SKILL.md` from
`.claude/templates/claude_mechanisms/skill.template.md`. Skip this step for techs
that only need reference knowledge — the rule + agent are enough.

### 5. Update the rule catalog

Update `.claude/rules.md` (create it if it does not exist yet) so the new assets
are discoverable in the same change:

- Add a row under a **"By technology"** table linking `tech-<name>.md` and noting
  its `paths:` scope and the paired `specialist-<name>` agent.
- If a skill was added in step 4, list it under the skills section.
- Keep catalog ↔ filesystem in sync — every `tech-*.md` rule has a catalog row.

### 6. Report

List the files created/updated:
- `.claude/rules/tech-<name>.md`
- `.claude/agents/specialist-<name>.md`
- `.claude/skills/<name>-<verb>/SKILL.md` (if added)
- `.claude/rules.md` (updated)
- `.claude/artifacts/research_<name>.md` (if persisted)

State the verified version of the technology and the verification date.

## Templates Referenced

- `.claude/templates/tech_specialist/rule.template.md` — the rule stencil
- `.claude/templates/tech_specialist/agent.template.md` — the agent stencil
- `.claude/templates/claude_mechanisms/skill.template.md` — optional skill stencil
- `.claude/templates/artifacts/research.template.md` — optional research artifact

## Constraints

- ALWAYS verify the API against live sources (Context7 / official docs); cite sources with dates
- ALWAYS set a sensible `paths:` scope on the rule — never leave the placeholder
- The specialist agent is read-only (analysis/guidance), not implementation
- Keep the catalog in sync in the same change
- Reuse the exemplar specialists' structure; do not invent a new shape

## Examples

- `/add-tech-specialist solr` → `tech-solr.md` (scoped to the Solr integration files) + `specialist-solr.md` + catalog row; optional `solr-query` skill if querying becomes a recurring workflow.
- `/add-tech-specialist language-server` → rule scoped to the LSP client module + a `specialist-language-server` agent.

$ARGUMENTS
