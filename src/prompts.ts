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
    `Run a code review of the current working branch against ${baseRef}.`,
    `Slack classified target: ${target}`,
    "",
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
