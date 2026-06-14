# /// script
# requires-python = ">=3.10"
# ///
"""SessionStart hook (startup|resume): load short project context.

Prints a compact context block at session start: the active-plan pointer from
`.claude/state/current_plan.md` (if it names a real plan) and a session count.
Simplified from the OCX original — no handoff queue or swarm-lock reporting.
Always exits 0; the hook is advisory.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(__import__("pathlib").Path(__file__).parent))

import hook_utils

# A current_plan.md whose first non-empty content line starts with one of
# these prefixes is treated as "no active plan" and not surfaced.
_EMPTY_PLAN_PREFIXES = ("no active plan", "# no active plan")


def read_plan_pointer(project_dir: str) -> str | None:
    """Return a one-line plan summary, or None when no plan is active.

    Reads `.claude/state/current_plan.md`. The first non-empty, non-comment
    line is used as the summary. Returns None when the file is missing or its
    summary indicates no active plan.
    """
    plan_file = Path(project_dir) / ".claude" / "state" / "current_plan.md"
    if not plan_file.exists():
        return None
    try:
        text = plan_file.read_text()
    except OSError:
        return None
    for raw in text.splitlines():
        line = raw.strip().lstrip("#").strip()
        if not line:
            continue
        if line.lower().startswith(_EMPTY_PLAN_PREFIXES):
            return None
        return line
    return None


def build_context(active_sessions: int, plan_summary: str | None) -> str:
    """Build the context string. Returns empty string when nothing to report."""
    parts: list[str] = []

    if plan_summary:
        parts.append(f"[ACTIVE PLAN]\n{plan_summary}")

    if active_sessions > 1:
        parts.append(
            f"[SESSIONS] {active_sessions} active Claude sessions in this project."
        )

    return "\n\n".join(parts)


def process(input_data: dict, project_dir: str) -> str:
    """Run session start logic given parsed input and project_dir."""
    source = input_data.get("source", "startup") or "startup"
    session_id = input_data.get("session_id", "") or ""

    state = hook_utils.StateManager(project_dir)
    state.clean_old_sessions()
    state.write_session(session_id, source)

    active_sessions = state.count_active_sessions()
    plan_summary = read_plan_pointer(project_dir)

    return build_context(active_sessions, plan_summary)


def main() -> None:
    input_data = hook_utils.read_input()

    project_dir = hook_utils.get_project_dir()
    if not project_dir:
        sys.exit(0)

    context = process(input_data, project_dir)
    if context:
        print(context)

    sys.exit(0)


if __name__ == "__main__":
    main()
