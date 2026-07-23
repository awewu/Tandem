# Top AI Design Skill Patterns

Use this reference when improving the skill, writing design prompts, or reviewing whether another AI design skill is worth adopting.

## What Strong Design Skills Do

- Define the audience and job-to-be-done before aesthetics.
- Translate brand into specific constraints: colors, typography, spacing, imagery, component behavior, tone, and prohibited moves.
- Require real artifacts: screenshots, assets, style tokens, design system files, product pages, or existing code.
- Separate strategy, design direction, implementation, and visual QA.
- Include acceptance criteria that can be verified on actual screens.
- Ask for screenshots or run browser verification after frontend work.
- Prefer established UI libraries and icon sets already present in the app.
- Keep instructions concise and point to references for brand systems or examples.

## Common Failure Modes

- Vague adjectives such as "modern", "premium", or "beautiful" without constraints.
- Overuse of gradients, glass panels, large rounded cards, and decorative backgrounds.
- Landing-page composition applied to professional tools.
- Brand colors used as page-wide decoration instead of information hierarchy.
- Missing responsive checks.
- Ignoring real logo constraints and product-domain boundaries.
- Inventing copy or visuals that conflict with the business context.

## Review Questions

- Does the skill know when to trigger?
- Does it tell the agent what to inspect before designing?
- Does it include source-of-truth references?
- Does it constrain bad AI defaults?
- Does it require visual verification?
- Can another agent use it without the original conversation?
- Does it keep detailed examples in references instead of bloating `SKILL.md`?
