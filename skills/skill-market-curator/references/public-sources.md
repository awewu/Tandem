# Public Skill Sources

Use this reference as a starting map, not a frozen leaderboard. Browse current pages before claiming a skill is "hot", "latest", or "most popular".

## Primary Sources

- OpenAI skills catalog: `https://github.com/openai/skills`
  - Treat `.system` as built-in, `.curated` as reviewed installable skills, and `.experimental` as less-reviewed candidates.
  - Prefer source folder links over third-party summaries.
- Agent Skills open standard: `https://agentskills.io`
  - Use to check format expectations and portability claims.

## Community Discovery Sources

These can surface candidates, but verify source, license, and maintenance before recommending:

- `https://skilld.dev`
- `https://llmbase.ai/skills/`
- `https://500k.io/skills/`
- `https://ossinsight.io/analyze/openai/skills`
- GitHub search for phrases such as:
  - `"SKILL.md" "Codex"`
  - `"Agent Skills" "SKILL.md"`
  - `topic:skills codex`
  - `path:SKILL.md openai skills`

## Popularity Signals

Use multiple signals because each one is noisy:

- GitHub stars/forks/watchers for a repository.
- Marketplace ranking, install count, upvote count, or listing prominence when visible.
- Recent commits, releases, issues, and pull requests.
- Mentions from credible posts or official docs.
- Whether the specific skill folder is maintained, not only the parent repository.

## Safety Checklist

Before recommending installation:

- Read `SKILL.md`.
- Check `agents/openai.yaml` for implicit invocation policy and external tool dependencies.
- Inspect scripts for network calls, destructive operations, broad filesystem access, credential handling, and dependency installation.
- Check license and provenance.
- Prefer installing with `$skill-installer` or a transparent copy from source rather than pasting unknown code.
