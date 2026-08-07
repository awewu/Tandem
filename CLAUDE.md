# Rhautt Nexus Claude Rules

Use `AGENTS.md` as the source of truth. This file exists only for Claude-specific
runtime preferences and must stay thin to avoid duplicate always-loaded context.

## Identity Lock (guard:nexus-naming)

- Software platform name: **Rhautt Nexus / 瑞合数智枢纽**
- Rhautt Comfort / 瑞合瑞德暖通科技集团 is the customer/group instance positioning — 客户/集团实例不替换软件平台名, and is not the software platform name.
- Rysnova / 瑞诺瓦 is the independent dealer-enablement software vendor (`Powered by Rysnova`).
- Rheem / Ruud / Everhot are equipment brands.

## Claude-Specific Notes

- Do not duplicate product locks, architecture locks, verification gates, or VI rules here.
- Read `docs/AGENT-MEMORY.md` only when the current task needs deeper product or architecture context.
- Installed skills may only be invoked when the user explicitly names or authorizes them.
- For the Everhot product CRUD MVP, prioritize the fastest functional closed loop. Do not add unrequested security audits, approval workflows, rollback systems, operator logs, or extra release gates.
- Issues and PRDs use Local Markdown under `.scratch/<feature>/`; see `docs/agents/issue-tracker.md` only when creating or triaging issues.
- Triage vocabulary lives in `docs/agents/triage-labels.md`; domain layout lives in `docs/agents/domain.md`.
