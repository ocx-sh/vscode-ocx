# /// script
# requires-python = ">=3.10"
# ///
"""PreToolUse hook (Bash): enforce pre-commit verification gate.

Fires only when a Bash tool call contains a git commit command **and** the
commit's git repo root matches this project's root. Commits in unrelated
sibling repos (e.g. `cd /home/me/dev/other && git commit …`) bypass the gate —
their verify gate isn't ours.

Verification mechanism (kept deliberately simple): after `npm run check`
(lint + check-types + build) passes, the agent stamps a sentinel:

    echo $(date +%s) > .claude/hooks/.state/commit-verified

The hook blocks the commit unless that sentinel is fresh (5-minute TTL). A
time-based sentinel was chosen over a "dist/ newer than src/" mtime heuristic
because `npm run check` is more than a build — it also runs lint and
type-checking, neither of which leaves a dated artifact. The sentinel records
"the full gate passed", which a build-output timestamp cannot.

Degrades gracefully before the toolchain exists: if there is no package.json
or `npm` is not on PATH (fresh clone, pre-`npm install`), the hook exits 0 with
a one-line warning instead of hard-blocking every commit.
"""

import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import hook_utils

_GIT_COMMIT_RE = re.compile(r"\bgit\s+commit\b")
_CD_PREFIX_RE = re.compile(r"^\s*cd\s+(?:'([^']+)'|\"([^\"]+)\"|(\S+))\s*&&")

# Verification freshness window. Matches the OCX gate.
_TTL_SECONDS = 300


# ---------------------------------------------------------------------------
# Pure logic functions (testable)
# ---------------------------------------------------------------------------


def is_git_commit(command: str) -> bool:
    """Return True if the shell command contains a git commit invocation."""
    return bool(_GIT_COMMIT_RE.search(command))


def parse_command_cwd(command: str) -> str | None:
    """Extract the working directory from a leading `cd X && ...` prefix.

    Three quoting forms supported: `cd '…'`, `cd "…"`, `cd unquoted`.
    """
    m = _CD_PREFIX_RE.match(command)
    if not m:
        return None
    return m.group(1) or m.group(2) or m.group(3)


def resolve_git_root(start_dir: str) -> str | None:
    """Return the absolute git toplevel containing ``start_dir`` or None."""
    try:
        result = subprocess.run(
            ["git", "rev-parse", "--show-toplevel"],
            cwd=start_dir,
            capture_output=True,
            text=True,
            timeout=5,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired):
        return None
    if result.returncode != 0:
        return None
    out = result.stdout.strip()
    return out or None


def commit_targets_this_project(command: str, project_dir: str) -> bool:
    """Return True when the git repo the command will commit into is this project.

    Heuristic — if we can't pin down the commit's cwd, assume the commit IS
    for this project so the gate still applies. False-positives on a cross-repo
    commit are acceptable; false-negatives (skipping the gate for an in-repo
    commit) are not.
    """
    cwd = parse_command_cwd(command)
    if cwd is None:
        return True
    git_root = resolve_git_root(cwd)
    if git_root is None:
        return True
    try:
        return os.path.realpath(git_root) == os.path.realpath(project_dir)
    except OSError:
        return True


def toolchain_ready(project_dir: str) -> bool:
    """Return True only when the npm toolchain is actually usable here.

    Requires both a package.json (this is a node project) and an `npm` binary
    on PATH. Either missing → the verify gate can't meaningfully run, so the
    caller should degrade to a warning rather than hard-block.
    """
    if not (Path(project_dir) / "package.json").exists():
        return False
    return shutil.which("npm") is not None


def build_deny_reason(state_dir: str) -> str:
    """Return the deny reason explaining how to pass the verification gate."""
    return (
        "BLOCKED: Cannot commit without passing verification.\n\n"
        "Run the full gate first:\n"
        "  npm run check        # = lint + check-types + build\n\n"
        "After it passes, mark verification complete:\n"
        f"  echo $(date +%s) > {state_dir}/commit-verified\n\n"
        "Then retry the commit. (Sentinel is valid for 5 minutes.)"
    )


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def main() -> None:
    data = hook_utils.read_input()

    tool_name: str = data.get("tool_name", "")
    if tool_name != "Bash":
        sys.exit(0)

    command: str = data.get("tool_input", {}).get("command", "")
    if not is_git_commit(command):
        sys.exit(0)

    project_dir = hook_utils.get_project_dir()
    if not project_dir:
        sys.exit(0)

    # Scope the gate to commits in *this* project's git repo.
    if not commit_targets_this_project(command, project_dir):
        sys.exit(0)

    # Degrade gracefully before the toolchain exists (fresh clone, pre-install).
    if not toolchain_ready(project_dir):
        print(
            "[verify] npm toolchain not ready (no package.json or npm not on "
            "PATH) — skipping commit-verification gate. Run `npm install` to "
            "enable it.",
            file=sys.stderr,
        )
        sys.exit(0)

    state = hook_utils.StateManager(project_dir)

    if state.is_recently_verified(_TTL_SECONDS):
        sys.exit(0)

    reason = build_deny_reason(str(state.state_dir))
    hook_utils.output_json(hook_utils.deny(reason))
    sys.exit(0)


if __name__ == "__main__":
    main()
