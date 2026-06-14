# /// script
# requires-python = ">=3.10"
# ///
"""PreToolUse hook (Write|Edit|MultiEdit): guard file operations.

Blocks edits to protected files (.git/, .env, .mcp.json) and prompts the
user to confirm when content looks like a leaked secret. Simplified from the
OCX original: the swarm file-lock machinery is dropped (single-agent repo).
"""

import sys

sys.path.insert(0, str(__import__("pathlib").Path(__file__).parent))

import re

import hook_utils

# ---------------------------------------------------------------------------
# Secret detection patterns — compiled once at module load
# ---------------------------------------------------------------------------

_SECRET_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    (
        "generic secret",
        re.compile(
            r"(api[_\-]?key|secret|password|token|credential).*[=:]\s*[\"']?[a-zA-Z0-9+/]{20,}",
            re.IGNORECASE,
        ),
    ),
    (
        "AWS access key",
        re.compile(r"AKIA[0-9A-Z]{16}"),
    ),
    (
        "JWT token",
        re.compile(r"eyJ[a-zA-Z0-9_\-]+\.eyJ[a-zA-Z0-9_\-]+\.[a-zA-Z0-9_\-]+"),
    ),
    (
        "exported secret",
        re.compile(
            r"export\s+(API_KEY|SECRET|PASSWORD|TOKEN|CREDENTIAL|AWS_|PRIVATE_KEY)=[\"']?[a-zA-Z0-9+/]{20,}",
            re.IGNORECASE,
        ),
    ),
    (
        "GitHub personal access token",
        re.compile(r"ghp_[a-zA-Z0-9]{36}"),
    ),
    (
        "VS Code Marketplace / Azure DevOps PAT",
        # vsce/ovsx publish tokens are 52-char Azure DevOps PATs; flag obvious
        # assignments so they never land in tasks.json, CI yaml, or source.
        re.compile(r"(VSCE_PAT|OVSX_PAT|AZURE_DEVOPS_EXT_PAT)\s*[=:]\s*[\"']?[a-z0-9]{52}", re.IGNORECASE),
    ),
    (
        "private key",
        re.compile(r"-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----"),
    ),
]

# Test/spec files are exempt from secret scanning — fixtures legitimately
# contain dummy tokens.
_TEST_FILE_SUFFIXES = (
    ".test.ts",
    ".test.tsx",
    ".test.js",
    ".test.mjs",
    ".spec.ts",
    ".spec.tsx",
    ".spec.js",
)

_PROTECTED_PATTERNS = (".git/", ".env", ".mcp.json")


# ---------------------------------------------------------------------------
# Pure logic functions (testable)
# ---------------------------------------------------------------------------


def is_test_file(rel_path: str) -> bool:
    """Return True if the path looks like a test/spec file."""
    return any(rel_path.endswith(suffix) for suffix in _TEST_FILE_SUFFIXES)


def detect_secrets(content: str) -> str | None:
    """Scan content for common secret patterns.

    Returns the secret type string on first match, or None if clean.
    """
    for secret_type, pattern in _SECRET_PATTERNS:
        if pattern.search(content):
            return secret_type
    return None


def is_protected(rel_path: str) -> bool:
    """Return True if rel_path matches any protected pattern."""
    return any(pattern in rel_path for pattern in _PROTECTED_PATTERNS)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def main() -> None:
    data = hook_utils.read_input()

    tool_name: str = data.get("tool_name", "")
    tool_input: dict = data.get("tool_input", {})

    file_path: str = tool_input.get("file_path") or tool_input.get("path") or ""

    # Not a file operation — nothing to do
    if not file_path:
        sys.exit(0)

    project_dir = hook_utils.get_project_dir()
    if not project_dir:
        sys.exit(0)
    rel_path = hook_utils.relative_path(file_path, project_dir)

    # --- Protected files ---
    if is_protected(rel_path):
        hook_utils.output_json(
            hook_utils.deny(
                f"Cannot modify protected file: {rel_path}. "
                "Use appropriate commands or escalate."
            )
        )
        sys.exit(0)

    # --- Secret detection (Write/Edit only, skip test files) ---
    if tool_name in ("Write", "Edit") and not is_test_file(rel_path):
        content: str = (
            tool_input.get("content") or tool_input.get("new_string") or ""
        )
        secret_type = detect_secrets(content)
        if secret_type:
            hook_utils.output_json(
                hook_utils.ask(
                    f"Potential {secret_type} detected in content. "
                    "Please verify this is not sensitive data."
                )
            )
            sys.exit(0)

    sys.exit(0)


if __name__ == "__main__":
    main()
