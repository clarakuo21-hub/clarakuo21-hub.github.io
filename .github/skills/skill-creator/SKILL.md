---
name: skill-creator
description: 'Create or improve SKILL.md files from real conversation workflows. Use when users ask to turn a process into a reusable skill, draft a new skill, refine an existing skill, or improve trigger quality, scope, and completion criteria.'
argument-hint: 'What should this skill produce?'
user-invocable: true
disable-model-invocation: false
---

# Skill Creator

Build high-signal, reusable skills by turning how the user works into a concrete SKILL.md workflow.

## Primary Outcome

Produce a valid SKILL.md that:
1. Encodes a repeatable process.
2. Captures branching decisions and quality checks.
3. Is easy for another agent to execute with minimal ambiguity.

## Workflow

1. Determine starting point.
- If the user already has a draft skill, review and improve it.
- If no draft exists, create a new skill from scratch.

2. Extract workflow from conversation context first.
- Identify explicit step order.
- Identify decision points and fallback paths.
- Identify success criteria and completion checks.

3. Clarify only missing essentials.
- Ask for outcome if it is unclear.
- Ask whether scope is workspace or personal when path choice is ambiguous.
- Ask whether the user wants a quick checklist or a full procedure when depth is unclear.

4. Draft the SKILL.md.
- Add YAML frontmatter with required fields: `name`, `description`.
- Keep the `description` keyword-rich so triggering works reliably.
- Write imperative, concrete instructions.
- Include clear end conditions.

5. Stress-test for weak spots.
- Find ambiguous instructions, overloaded steps, and undefined outputs.
- Propose focused edits to improve determinism.

6. Iterate with the user.
- Ask about the most uncertain assumptions.
- Revise SKILL.md based on user feedback.

7. Finalize handoff.
- Summarize what the skill produces.
- Provide 3 realistic example prompts for testing.
- Propose related customizations to create next.

## Skill Authoring Rules

1. Name and path consistency.
- Skill folder name must match `name` in frontmatter.

2. Trigger quality.
- Put both "what it does" and "when to use" signals in `description`.
- Favor specific user intents and phrases over generic wording.

3. Progressive disclosure.
- Keep SKILL.md focused.
- Move large references into `./references/` and scripts into `./scripts/` when needed.

4. Actionable instructions.
- Prefer verbs and explicit outputs.
- Avoid vague guidance like "do your best" without checks.

## Completion Checklist

Before considering the task complete, verify:
1. Frontmatter is valid YAML and includes required fields.
2. Procedure has explicit order and branch logic.
3. Output expectations are concrete.
4. At least one quality gate is defined.
5. User receives test prompts and related next-customization suggestions.

## Output Contract for This Skill

When invoked, always return:
1. The finalized SKILL.md content.
2. A short summary of what the skill produces.
3. Three example prompts to try.
4. Two or three related customizations to build next.