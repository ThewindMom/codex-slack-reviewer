import type { SlackThread } from "./types"

export function formatThread(thread: SlackThread): string {
  return thread.messages
    .map((message) => `[${message.ts}] ${message.user}: ${message.text}`)
    .join("\n")
}

export function classificationPrompt(thread: SlackThread): string {
  return [
    "You classify Slack mentions sent to a Codex code-review bot.",
    "Decide whether the requester is asking for a code review, merge readiness",
    "assessment, PR/branch review, or review of pushed work.",
    "",
    "Return only strict JSON with one of these shapes:",
    '{"kind":"review_request","reason":"short reason","target":"branch, PR, commit, or pushed work"}',
    '{"kind":"ignore","reason":"short reason"}',
    "",
    "Treat status updates with no review/merge ask as ignore.",
    "Treat ambiguous asks like 'can this merge?', 'review this', 'what do you think",
    "of what got pushed?', and '@codex please check this' as review_request.",
    "",
    "Slack trigger message:",
    formatThread(thread),
  ].join("\n")
}

export function reviewPrompt(thread: SlackThread, baseRef: string, target: string): string {
  return [
    `Run a code review of the requested branch against ${baseRef}.`,
    `Slack classified target: ${target}`,
    "",
    "Switch to the requested branch before reviewing. Use the Slack classified target",
    "and trigger message to determine the branch. Fetch the branch from origin if it",
    "is not available locally. Do not assume the currently checked-out branch is the branch to review.",
    `If Git refuses to switch because the branch is checked out in another worktree, review origin/${target}`,
    "in a detached checkout or create a temporary worktree for the requested branch.",
    "Use this Slack trigger message as reviewer context, but ground findings in the repository diff.",
    "Focus on bugs, regressions, missing tests, merge blockers, and risky behavior.",
    "Start with whether it looks mergeable. If there are findings, list them by severity",
    "with file and line references where possible. Keep the Slack response concise.",
    "Use ultrawork mode for the review: verify claims with concrete evidence, not inference.",
    "If the project supports it, validate the result with this exact command before judging",
    "merge readiness: docker compose down -v && docker compose up --build -d.",
    "Run browser QA against the rebuilt app when there is a browser-facing surface, and",
    "include any validation gaps in the final review if Docker or browser QA cannot be run.",
    "",
    "Slack trigger message:",
    formatThread(thread),
  ].join("\n")
}
