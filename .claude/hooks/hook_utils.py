"""Shared utilities for Claude Code hooks.

Provides JSON I/O, hook response builders, lightweight session/verification
state management, and path utilities. Imported by all hook scripts via
``sys.path`` insertion.

Ported from the OCX reference config and slimmed for this repo: the
swarm-coordination machinery (file locks, file-tracker log, cross-session
learnings store) is intentionally dropped — this extension is a single-agent
project. What remains is what the sibling hooks actually call.
"""

from __future__ import annotations

import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path


# ---------------------------------------------------------------------------
# JSON I/O
# ---------------------------------------------------------------------------


def read_input() -> dict:
    """Read and parse JSON from stdin. Returns empty dict on invalid input."""
    try:
        data = sys.stdin.read()
        if not data.strip():
            return {}
        return json.loads(data)
    except (json.JSONDecodeError, OSError):
        return {}


def output_json(data: dict) -> None:
    """Print compact JSON to stdout."""
    print(json.dumps(data, separators=(",", ":")))


# ---------------------------------------------------------------------------
# Hook Response Builders
# ---------------------------------------------------------------------------


def deny(reason: str) -> dict:
    """Build a PreToolUse deny response (hard block)."""
    return {
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": reason,
        }
    }


def ask(reason: str) -> dict:
    """Build a PreToolUse ask response (prompt the user to confirm)."""
    return {
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "ask",
            "permissionDecisionReason": reason,
        }
    }


def additional_context(text: str) -> dict:
    """Build an additionalContext response for any event."""
    return {"hookSpecificOutput": {"additionalContext": text}}


# ---------------------------------------------------------------------------
# Environment
# ---------------------------------------------------------------------------


def get_project_dir() -> str | None:
    """Return CLAUDE_PROJECT_DIR or None. Never falls back to cwd."""
    return os.environ.get("CLAUDE_PROJECT_DIR")


# ---------------------------------------------------------------------------
# Path Utilities
# ---------------------------------------------------------------------------


def relative_path(file_path: str, project_dir: str) -> str:
    """Compute relative path, handling both project-relative and absolute."""
    if file_path.startswith(project_dir):
        rel = file_path[len(project_dir):]
        return rel.lstrip("/").lstrip("\\")
    return file_path


# ---------------------------------------------------------------------------
# State Manager
# ---------------------------------------------------------------------------


class StateManager:
    """Manages ``.claude/hooks/.state/`` for lightweight hook coordination.

    Two responsibilities survive from the OCX original:

    * **Session tracking** — SessionStart writes a small marker so the loader
      can report how many sessions are active.
    * **Commit verification sentinel** — ``pre_commit_verification.py`` writes
      a ``commit-verified`` timestamp after ``npm run check`` passes and reads
      it here to gate commits.
    """

    def __init__(self, project_dir: str) -> None:
        self.project_dir = Path(project_dir)
        self.hooks_dir = self.project_dir / ".claude" / "hooks"
        self.state_dir = self.hooks_dir / ".state"

    def ensure_dirs(self) -> None:
        """Create .state/ if missing."""
        self.state_dir.mkdir(parents=True, exist_ok=True)

    # --- Session tracking ---

    def write_session(self, session_id: str, source: str) -> None:
        """Write a session tracking file."""
        self.ensure_dirs()
        short = session_id[:8] if session_id else "unknown"
        data = {
            "session_id": session_id,
            "started": datetime.now(timezone.utc).isoformat(),
            "source": source,
        }
        session_file = self.state_dir / f"session_{short}.json"
        try:
            session_file.write_text(json.dumps(data))
        except OSError:
            pass

    def count_active_sessions(self) -> int:
        """Count active session marker files."""
        if not self.state_dir.exists():
            return 0
        return len(list(self.state_dir.glob("session_*.json")))

    def clean_old_sessions(self, max_age_hours: int = 24) -> None:
        """Remove session files older than max_age_hours."""
        if not self.state_dir.exists():
            return
        cutoff = time.time() - (max_age_hours * 3600)
        for f in self.state_dir.glob("session_*.json"):
            try:
                if f.stat().st_mtime < cutoff:
                    f.unlink()
            except OSError:
                pass

    # --- Commit verification sentinel ---

    def verified_marker(self) -> Path:
        """Path to the commit-verification sentinel file."""
        return self.state_dir / "commit-verified"

    def mark_verified(self) -> None:
        """Stamp the verification sentinel with the current epoch second."""
        self.ensure_dirs()
        try:
            self.verified_marker().write_text(str(int(time.time())))
        except OSError:
            pass

    def is_recently_verified(self, ttl_seconds: int = 300) -> bool:
        """Return True if verification was marked within ``ttl_seconds``."""
        marker = self.verified_marker()
        if not marker.exists():
            return False
        try:
            verified_time = int(marker.read_text().strip())
            return (time.time() - verified_time) < ttl_seconds
        except (ValueError, OSError):
            return False
