---
name: shipit:discuss
description: Discussion mode — chat about your project without any code changes
argument-hint: "<topic or question>"
allowed-tools:
  - Read
  - Glob
  - Grep
  - AskUserQuestion
---

<objective>
Have a focused discussion about the project, architecture, approach, or ideas — without making any code changes.
</objective>

<rules>
- **NO code changes.** Do not use Write, Edit, Bash, or any tool that modifies files.
- **NO commits.** Do not create, stage, or commit anything.
- **Reading is allowed.** You can read files, search the codebase, and explore to give informed answers.
- **This is a conversation.** Ask questions, give opinions, suggest approaches, discuss trade-offs.
</rules>

<process>

## Step 1: Load Context

Read these files if they exist (silently skip if missing):
- `.shipit/PROJECT.md` — understand what the project is
- `.shipit/STATE.md` — understand current progress
- `.shipit/PLAN.md` — understand what's being worked on
- `.shipit/HANDOFF.md` — understand what's been accomplished

## Step 2: Discuss

Based on the user's topic ($ARGUMENTS), have a productive discussion. You can:

- **Answer questions** about the codebase, architecture, or approach
- **Explore code** by reading files and searching to give informed opinions
- **Suggest approaches** with trade-offs for the user to consider
- **Review ideas** the user is thinking about before they commit to implementing
- **Explain code** — walk through how something works
- **Compare options** — evaluate different libraries, patterns, or architectures
- **Plan ahead** — help think through what needs to happen without writing a formal plan

Keep the conversation natural. Ask follow-up questions when the user's intent isn't clear.

## Step 3: Transition (Optional)

If the discussion leads to a clear action, suggest the appropriate command:
- "Ready to implement? Run `/shipit:go <task>` to start."
- "Want a detailed plan first? Run `/shipit:plan <description>`."
- "Want to debug this? Run `/shipit:debug <issue>`."

Do NOT execute these commands yourself. Only suggest them.

</process>
