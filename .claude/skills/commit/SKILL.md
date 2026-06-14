---
name: commit
description: Use when the user says "commit", "/commit", "save progress", or asks to land working changes on a feature branch. Working-phase posture — minimises commit count, can amend rolling Checkpoints, offers a one-time PR prompt. Conventional Commits.
user-invocable: true
disable-model-invocation: true
argument-hint: "[optional context or --pr | --no-pr | --amend]"
triggers:
  - "commit"
  - "save progress"
  - "commit my changes"
  - "commit the changes"
  - "stage and commit"
---

# /commit — Working-Phase Commit Workflow

Commit the working tree during active development on a feature branch. Working-phase posture: bundle freely, amend rolling Checkpoints, keep `main` clean.

## Working-Phase Posture

- **Minimise commit count.** Bundle freely. Amend rolling Checkpoints.
- **One concern per commit relaxed.** An honest bundle message (`chore: bundle skill + rule + agent tweaks`) beats a fake one-concern narrative.
- **Don't badger the user about splitting.** Feature branches are working-phase by default; clean up before landing.

## Inputs

Optional free-text arg. Treat it as an intent hint (e.g., `fix activation race`), not the full message — still draft the final message. Flags:

- `/commit --amend` — explicitly amend HEAD (bypasses the Checkpoint-only safeguard)
- `/commit --pr` — force the PR-branch prompt even if previously declined
- `/commit --no-pr` — skip and record the PR skip

## Workflow

### 1. Snapshot state (parallel batch)

- `git status --porcelain=v1` (never `-uall`)
- `git diff --staged` and `git diff --stat`
- `git log -5 --oneline` — recent commits + scan for a stranded `Checkpoint`
- `git rev-parse --abbrev-ref HEAD` — current branch
- `git rev-list --count main..HEAD 2>/dev/null` — commits ahead of main
- `git config --get branch.<current>.skip-pr-prompt` — PR prompt already answered?
- `git log -1 --pretty=%s` — is HEAD itself a Checkpoint?
- `gh pr view --json number,state 2>/dev/null` — open PR for the branch?

If the working tree is clean **and** HEAD is not a Checkpoint, stop with "nothing to commit".

### 2. Checkpoint scan (window, not just HEAD)

Look at the last 5 commits for any with the subject exactly `Checkpoint`.

**Case A — HEAD itself is `Checkpoint`:**

| Sub-case | Behavior |
|---|---|
| **Dirty tree** (unstaged/untracked changes exist) | **Auto-amend** — stage changed files by name and `git commit --amend --no-edit`. Rolling Checkpoints absorb active changes. Report what folded in. |
| **Clean tree** (Checkpoint holds accumulated work) | The Checkpoint is the deliverable. Draft a conventional message from its diff (`git diff main..HEAD`), show it, amend: `git commit --amend -m "<message>"`. |

**Case B — `Checkpoint` exists at HEAD~1..HEAD~5 but not at HEAD (stranded):** warn the user. Offer: commit on top and leave it (default), or stop and clean up the history first, or skip.

**Case C — no Checkpoint in window:** proceed.

### 3. Commit strategy

On a feature branch, prefer one of:

1. **Amend HEAD** when HEAD is a fresh local commit you authored (not yet on `main`'s reach) **and** the new work clearly continues the same concern. Ask first — amending rewrites commit hashes.
2. **New commit on top** when HEAD already represents a distinct concern.
3. **Start a Checkpoint** (`git commit -m "Checkpoint"`) when the user says "save progress" or the work is not yet coherent enough to name.

On `main`: stop. Tell the user to create a feature branch first.

### 4. Draft the commit message

Follow **Conventional Commits v1.0.0**. See [`commit_reference.md`](./commit_reference.md) for the full cheat sheet. Key points:

- `chore:` for AI/tooling files (`.claude/`, CLAUDE.md, skills, rules, hooks) — keeps them out of the changelog
- `build:` for build/deps/`package.json`; `ci:` for GitHub Actions workflows
- Imperative mood, lowercase description, no trailing period, subject ≤72 chars
- Body explains **why**, not what, when non-obvious
- Breaking: `!` before the colon **and** a `BREAKING CHANGE:` footer
- **Never** add `Co-Authored-By`

Show the drafted message to the user for approval before committing.

### 5. PR-branch prompt (first time per branch only)

Skip entirely if any is true: `git config --get branch.<current>.skip-pr-prompt` returns `true`; an open PR already exists; the current branch is `main` (stop and tell the user to branch first).

Otherwise ask (via `AskUserQuestion`):

1. **Create feature branch + PR** — derive a name from the commit subject (e.g. `feat/status-bar`), branch from HEAD, commit there, `gh pr create` with title and body summary
2. **Stay on the current branch** — commit here, then record `git config branch.<current>.skip-pr-prompt true`. Never ask again unless `/commit --pr`
3. **Cancel** — abort

### 6. Stage and commit

- Stage files **by name**, never `git add -A` / `.`. Prevents accidentally committed secrets and sweeping in pre-staged files the message doesn't describe.
- Warn before staging anything matching `.env*`, `*credentials*`, `*.pem`, `*.key`, or `token` patterns; require explicit confirmation.
- **`--amend` must fold the dirty tree into HEAD.** When `/commit --amend` is invoked with uncommitted changes, `git add <files>` first — `--amend` with nothing staged silently becomes a message-only amend that drops active work. After amending, run `git show --stat HEAD` and confirm the expected files appear before reporting success.
- **Verify before committing.** Run `npm run check` (lint + types + build). If it fails, fix the root cause — do not bypass.
- Commit with a HEREDOC:

  ```sh
  git commit -m "$(cat <<'EOF'
  <type>[scope]: <description>

  <optional body explaining why>
  EOF
  )"
  ```

- **Never** use `--no-verify`, `--no-gpg-sign`, or other hook-skipping flags. If a hook fails, fix the root cause and create a **new** commit.
- **Never push.** The human decides when to push.

### 7. Report

One or two sentences: commit hash, subject, whether a stranded-Checkpoint case was handled, whether a PR was opened. Nothing else.

## References

- [`commit_reference.md`](./commit_reference.md) — Conventional Commits v1.0.0 cheat sheet
