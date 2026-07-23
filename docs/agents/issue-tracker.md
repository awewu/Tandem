# Issue tracker: Local Markdown

This repository stores issues and PRDs as Markdown files under `.scratch/`.

## Conventions

- Use one directory per feature: `.scratch/<feature-slug>/`.
- Store the PRD at `.scratch/<feature-slug>/PRD.md`.
- Store implementation issues at `.scratch/<feature-slug>/issues/<NN>-<slug>.md`, numbered from `01`.
- Record triage state near the top of each issue file as `Status: <role>`.
- Append comments and conversation history under a `## Comments` heading.

## Publishing

When a skill publishes to the issue tracker, it creates the required files under `.scratch/<feature-slug>/`.

When a skill fetches a ticket, it reads the referenced local Markdown path or issue number.
