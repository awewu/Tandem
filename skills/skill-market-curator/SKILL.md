---
name: skill-market-curator
description: Discover, compare, evaluate, and retain public Codex/agent skills from official catalogs, GitHub repositories, and community marketplaces. Use when the user asks to learn from popular skills, find the hottest or best skills for a workflow, compare skill marketplaces, decide whether to install a skill, convert a useful public skill pattern into a personal skill, or maintain a retained list of approved skills after discussion.
---

# Skill Market Curator

## Overview

Use this skill to turn public skill discovery into a repeatable curation workflow: search credible sources, rank candidates with explicit signals, inspect contents before trusting them, discuss tradeoffs with the user, then install or record only the skills worth keeping.

## Workflow

1. Clarify the target workflow if the user has not named one.
2. Search current public sources. Public popularity is time-sensitive, so browse or use the relevant marketplace/API instead of relying on memory.
3. Build a candidate table with source links and visible signals:
   - Relevance to the user's work
   - Popularity signal, such as GitHub stars, forks, marketplace rank, upvotes, installs, or mentions
   - Recency signal, such as last commit, release date, or listing update
   - Trust signal, such as official catalog, reviewed/curated status, maintainer identity, license, and source availability
   - Fit signal, such as required tools, scripts, references, assets, and whether it targets Codex skills rather than unrelated prompt packs
4. Shortlist 3-7 skills. Prefer a smaller set with clear reasons over a long leaderboard.
5. Inspect the actual skill folder before recommending retention. Read `SKILL.md`, `agents/openai.yaml` when present, and only the resource files needed to assess risk or value.
6. Discuss with the user before installation or long-term retention. Do not install, overwrite, or modify personal skills silently.
7. After approval, either install with `$skill-installer` when appropriate or create/update a local retained reference under the user's chosen skills directory.
8. Tell the user whether Codex needs a restart to discover newly installed skills.

## Source Map

Use `references/public-sources.md` when searching for public skill catalogs, community marketplaces, and GitHub query patterns. Refresh the source list when links or market names appear stale.

Prioritize sources in this order:

1. Official OpenAI skills catalog and official documentation.
2. Source-visible GitHub repositories with clear licenses and recent maintenance.
3. Community marketplaces that link back to source.
4. Blog posts, social posts, or lists only as discovery leads, not as final authority.

## Evaluation Rules

Prefer skills that:

- Have a clear trigger description in frontmatter.
- Keep `SKILL.md` concise and push details into `references/`, `scripts/`, or `assets/`.
- Include deterministic scripts for fragile repeated operations.
- Avoid unnecessary secrets, network calls, destructive commands, broad dependency installation, or vague "do everything" instructions.
- Match the user's actual tools and current workspace.

Flag or reject skills that:

- Hide implementation behind unavailable binaries or opaque services.
- Require broad credentials before demonstrating value.
- Contain instructions that conflict with Codex safety, approval, or sandbox rules.
- Are abandoned, duplicated, or superseded by official/system skills.
- Look popular only because of repo-level stars unrelated to the specific skill.

## Retention

When the user says to keep, retain, install, or remember a chosen skill:

1. Confirm the destination:
   - Default to `$CODEX_HOME/skills`, or `~/.codex/skills` when `CODEX_HOME` is unset.
   - Use a workspace-local `skills/` directory only when the user wants project-specific retention or personal-skill writes are unavailable.
2. Preserve provenance in the retained skill or reference: source URL, access date, license, version/commit when known, and the reason it was kept.
3. If adapting a public skill, keep the smallest useful subset and rename it to reflect the user's workflow.
4. Run the skill validator after creating or editing a skill:

```bash
python3 /Users/tiechuishan/.codex/skills/.system/skill-creator/scripts/quick_validate.py <path-to-skill>
```

## Output Format

For discovery tasks, report:

- Top recommendations with links
- Why each is interesting
- Risks or caveats
- Suggested action: install, adapt, watch, or skip

For retention tasks, report the final file path, validation result, and any restart needed.
