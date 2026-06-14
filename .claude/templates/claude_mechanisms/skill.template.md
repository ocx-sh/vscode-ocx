---
name: [skill-name]
description: [Clear description of what this skill does and when Claude should use it. Include trigger phrases like "Use when..." to help with skill invocation.]
user-invocable: true
# disable-model-invocation: true   # set when this skill should ONLY run on explicit /invoke
argument-hint: "[argument]"
triggers:
  - "phrase 1"
  - "phrase 2"
allowed-tools: Read, Glob, Grep
---

<!--
Skills = model-invoked workflows. Discovered via description match.

Required fields:
  - name: lowercase, hyphens only, max 64 chars, must match directory name
  - description: max 1024 chars, CRITICAL for auto-discovery (include "Use when...")

Optional fields:
  - user-invocable: true exposes a /<name> slash command
  - disable-model-invocation: true blocks auto-trigger (explicit /<name> only)
  - argument-hint: shown in the slash-command UI
  - triggers: list of natural-language phrases that should surface the skill
  - allowed-tools: Comma-separated list to restrict tool access

Description best practices:
  GOOD: "Implementation skill. Use when writing, fixing, or refactoring extension code."
  BAD:  "Helps with code"

Supporting files: drop a sibling .md next to SKILL.md for progressive
disclosure (e.g. commit_reference.md). No subdirs — Claude Code only
finds skills at .claude/skills/<name>/SKILL.md exactly.

Location: .claude/skills/[skill-name]/SKILL.md
Body < 500 lines.
-->

# [Skill Name]

## Overview

[Skill purpose + scope, brief]

## Workflow

1. **Step 1** — [Description]
2. **Step 2** — [Description]
3. **Step 3** — [Description]

## Feedback Loops

1. [Action]
2. [Validation]
3. If [condition], [correction]
4. Repeat until [success criteria]

## Relevant Rules

- `.claude/rules/[rule].md` — [why relevant]

## Best Practices

- [Practice 1]
- [Practice 2]

## Anti-Patterns

- [What to avoid 1]
- [What to avoid 2]

## Resources

- `[Sibling Reference](./[skill-name]_reference.md)` — optional progressive-disclosure file beside SKILL.md

$ARGUMENTS
