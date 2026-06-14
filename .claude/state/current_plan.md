# No active plan

No active plan. Set by `/architect` or a swarm-plan flow.

This file is the single pointer the SessionStart hook
(`.claude/hooks/session_start_loader.py`) reads to surface the current plan at
the top of each session. Persisted plan documents live under
`.claude/state/plans/`.
