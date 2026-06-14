# /// script
# requires-python = ">=3.10"
# dependencies = ["pytest", "pyyaml"]
# ///
"""Lightweight structural validation for the `.claude/` AI configuration.

Pure filesystem checks — no LLM invocation. Verifies that rules, agents, and
skills follow the conventions the harness relies on, and that the rule catalog
(`.claude/rules.md`) stays in sync with `.claude/rules/`.

Run (uv resolves the PEP 723 deps automatically):
    uv run .claude/tests/test_ai_config.py
or:
    cd .claude/tests && uv run pytest test_ai_config.py -v
or with a venv that has pytest + pyyaml:
    pytest .claude/tests/test_ai_config.py -v
"""

from __future__ import annotations

from pathlib import Path

import pytest
import yaml

ROOT = Path(__file__).resolve().parents[2]
CLAUDE_DIR = ROOT / ".claude"
RULES_DIR = CLAUDE_DIR / "rules"
AGENTS_DIR = CLAUDE_DIR / "agents"
SKILLS_DIR = CLAUDE_DIR / "skills"
RULES_CATALOG = CLAUDE_DIR / "rules.md"
CLAUDE_MD = ROOT / "CLAUDE.md"

# Global rules (no `paths:` frontmatter) must be drawn from this allowlist.
# Asserted as a SUBSET — robust to siblings adding only some of them.
GLOBAL_RULE_ALLOWLIST = frozenset(
    {
        "quality-core.md",
        "product-tech-strategy.md",
        "product-context.md",
    }
)

VALID_MODELS = frozenset({"haiku", "sonnet", "opus"})


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _extract_frontmatter_block(path: Path) -> str | None:
    """Return the raw text between the first two `---` fences, or None."""
    text = path.read_text()
    if not text.startswith("---"):
        return None
    parts = text.split("---", 2)
    if len(parts) < 3:
        return None
    return parts[1]


def _tolerant_parse(front: str) -> dict:
    """Minimal scalar/list frontmatter parser.

    Fallback for the common, harness-tolerated case where a `description:`
    scalar contains an inline ``: `` (e.g. ``... Trigger: /architect.``) that
    strict YAML rejects as a nested mapping. Mirrors the parsing the
    `user_prompt_router.py` hook does at runtime: top-level `key: value`
    scalars and `key:` followed by `- item` lists.
    """
    result: dict = {}
    current_list_key: str | None = None
    for raw in front.splitlines():
        if not raw.strip():
            current_list_key = None
            continue
        if raw.lstrip().startswith("- "):
            if current_list_key is None:
                continue
            item = raw.split("- ", 1)[1].strip().strip('"').strip("'")
            result.setdefault(current_list_key, []).append(item)
            continue
        if ":" in raw and not raw.startswith((" ", "\t")):
            key, _, value = raw.partition(":")
            key = key.strip()
            value = value.strip()
            if not value:
                current_list_key = key
                continue
            current_list_key = None
            result[key] = value.strip('"').strip("'")
    return result


def _parse_frontmatter(path: Path) -> dict:
    """Return the parsed frontmatter of a markdown file, or {} if none.

    Tries strict YAML first; on a YAML error (almost always a bare ``: `` in an
    unquoted description scalar, which Claude Code itself tolerates) falls back
    to a tolerant line parser so the structural tests stay meaningful instead of
    failing on a YAML quirk. Genuinely broken frontmatter (e.g. a list where a
    scalar is expected) still surfaces via the field-level assertions.
    """
    front = _extract_frontmatter_block(path)
    if front is None:
        return {}
    try:
        data = yaml.safe_load(front)
        if isinstance(data, dict):
            return data
    except yaml.YAMLError:
        pass
    return _tolerant_parse(front)


def _rule_files() -> list[Path]:
    if not RULES_DIR.is_dir():
        return []
    return sorted(RULES_DIR.glob("*.md"))


def _agent_files() -> list[Path]:
    if not AGENTS_DIR.is_dir():
        return []
    return sorted(AGENTS_DIR.glob("*.md"))


def _skill_files() -> list[Path]:
    if not SKILLS_DIR.is_dir():
        return []
    return sorted(SKILLS_DIR.glob("*/SKILL.md"))


# ---------------------------------------------------------------------------
# Rules
# ---------------------------------------------------------------------------


class TestRules:
    """Every rule must parse; scoping conventions must hold."""

    def test_every_rule_frontmatter_parses(self) -> None:
        """Each `.claude/rules/*.md` must yield a non-empty frontmatter dict.

        A rule with a `---` fence whose body parses to nothing is malformed.
        Rules legitimately may have no frontmatter at all (no leading `---`),
        which is fine — those return {} and are skipped.
        """
        errors: list[str] = []
        for rule in _rule_files():
            if _extract_frontmatter_block(rule) is None:
                continue  # no frontmatter fence — allowed
            if not _parse_frontmatter(rule):
                errors.append(rule.name)
        assert not errors, f"Rules with unparseable/empty frontmatter: {errors}"

    def test_non_global_rules_have_paths_list(self) -> None:
        """A rule with `paths:` must declare it as a non-empty list.

        Rules without `paths:` are 'global' and validated separately. A rule
        that *has* a `paths:` key must give a list of glob strings.
        """
        bad: list[str] = []
        for rule in _rule_files():
            fm = _parse_frontmatter(rule)
            if "paths" not in fm:
                continue  # global rule — checked elsewhere
            paths = fm["paths"]
            if not isinstance(paths, list) or not paths:
                bad.append(rule.name)
        assert not bad, (
            f"Rules whose `paths:` is not a non-empty list: {bad}. "
            f"Path-scoped rules must declare globs as a YAML list."
        )

    def test_global_rules_subset_of_allowlist(self) -> None:
        """Global rules (no `paths:`) must be a subset of the allowlist.

        Subset, not equality — siblings may still be writing some of the
        allowed global rules. Any global rule outside the allowlist is a real
        violation (an always-loaded file that shouldn't be).
        """
        globals_found = {
            rule.name
            for rule in _rule_files()
            if not _parse_frontmatter(rule).get("paths")
        }
        unexpected = globals_found - GLOBAL_RULE_ALLOWLIST
        assert not unexpected, (
            f"Unexpected global rules (no `paths:`): {sorted(unexpected)}. "
            f"Global rules must be one of {sorted(GLOBAL_RULE_ALLOWLIST)} or "
            f"declare a `paths:` list to become path-scoped."
        )


# ---------------------------------------------------------------------------
# Agents
# ---------------------------------------------------------------------------


class TestAgents:
    """Agent frontmatter conventions."""

    def test_agent_frontmatter_fields(self) -> None:
        """Each agent must have name (== filename), description, tools, model."""
        errors: list[str] = []
        for agent in _agent_files():
            fm = _parse_frontmatter(agent)
            stem = agent.stem
            name = fm.get("name")
            if name != stem:
                errors.append(
                    f"{agent.name}: frontmatter name {name!r} must match filename {stem!r}"
                )
            if not fm.get("description"):
                errors.append(f"{agent.name}: missing/empty description")
            if not fm.get("tools"):
                errors.append(f"{agent.name}: missing/empty tools")
            model = fm.get("model")
            if model not in VALID_MODELS:
                errors.append(
                    f"{agent.name}: model {model!r} not in {sorted(VALID_MODELS)}"
                )
        assert not errors, "Agent frontmatter problems:\n  " + "\n  ".join(errors)


# ---------------------------------------------------------------------------
# Skills
# ---------------------------------------------------------------------------


class TestSkills:
    """Skill layout + frontmatter conventions."""

    def test_skill_dirs_have_skill_md(self) -> None:
        """Every directory under `.claude/skills/` must contain a SKILL.md."""
        if not SKILLS_DIR.is_dir():
            pytest.skip("no .claude/skills/ directory yet")
        missing = [
            d.name
            for d in sorted(SKILLS_DIR.iterdir())
            if d.is_dir() and not (d / "SKILL.md").exists()
        ]
        assert not missing, f"Skill dirs without SKILL.md: {missing}"

    def test_skill_frontmatter_name_and_description(self) -> None:
        """Each SKILL.md must have name (== dir name) and a description."""
        errors: list[str] = []
        for skill_md in _skill_files():
            fm = _parse_frontmatter(skill_md)
            dir_name = skill_md.parent.name
            name = fm.get("name")
            if name != dir_name:
                errors.append(
                    f"{dir_name}: frontmatter name {name!r} must match dir {dir_name!r}"
                )
            if not fm.get("description"):
                errors.append(f"{dir_name}: missing/empty description")
        assert not errors, "Skill frontmatter problems:\n  " + "\n  ".join(errors)


# ---------------------------------------------------------------------------
# Rule catalog (`.claude/rules.md`) — catalog-drift check
# ---------------------------------------------------------------------------


class TestRuleCatalog:
    """`.claude/rules.md` must mention every rule filename (no drift)."""

    def test_catalog_exists(self) -> None:
        assert RULES_CATALOG.exists(), (
            "`.claude/rules.md` must exist — it is the rule catalog pointed to "
            "from CLAUDE.md."
        )

    def test_catalog_mentions_every_rule(self) -> None:
        """Every `.claude/rules/*.md` filename must appear in the catalog.

        Reported as a list of missing entries (so a failure tells you exactly
        what to add), but it IS a hard assertion — the config is complete when
        CI runs, and drift must fail the build.
        """
        if not RULES_CATALOG.exists():
            pytest.fail("`.claude/rules.md` missing — cannot check catalog drift")
        catalog_text = RULES_CATALOG.read_text()
        missing = [rule.name for rule in _rule_files() if rule.name not in catalog_text]
        assert not missing, (
            f"Rules missing from `.claude/rules.md` (catalog drift): {missing}. "
            f"Add each new rule to the relevant table in the catalog."
        )


# ---------------------------------------------------------------------------
# CLAUDE.md ↔ catalog wiring
# ---------------------------------------------------------------------------


class TestClaudeMd:
    """CLAUDE.md must point at the catalog so it stays discoverable."""

    def test_claude_md_points_to_catalog(self) -> None:
        assert CLAUDE_MD.exists(), "CLAUDE.md must exist at the repo root"
        assert ".claude/rules.md" in CLAUDE_MD.read_text(), (
            "CLAUDE.md must reference `.claude/rules.md` so the catalog is "
            "discoverable every session."
        )


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(pytest.main([__file__, "-v"]))
