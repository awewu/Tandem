# Rhautt Nexus Claude Rules

Use `AGENTS.md` as the source of truth. This file exists only for Claude-specific
runtime preferences and must stay thin to avoid duplicate always-loaded context.

## Claude-Specific Notes

- Do not duplicate product locks, architecture locks, verification gates, or VI rules here.
- Read `docs/AGENT-MEMORY.md` only when the current task needs deeper product or architecture context.
- Installed skills may only be invoked when the user explicitly names or authorizes them.
- For the Everhot product CRUD MVP, prioritize the fastest functional closed loop. Do not add unrequested security audits, approval workflows, rollback systems, operator logs, or extra release gates.
- Issues and PRDs use Local Markdown under `.scratch/<feature>/`; see `docs/agents/issue-tracker.md` only when creating or triaging issues.
- Triage vocabulary lives in `docs/agents/triage-labels.md`; domain layout lives in `docs/agents/domain.md`.
