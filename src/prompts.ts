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
    "Slack thread:",
    formatThread(thread),
  ].join("\n")
}

export function reviewPrompt(thread: SlackThread, baseRef: string, target: string): string {
  return [
    `Run a code review of the current working branch against ${baseRef}.`,
    `Slack classified target: ${target}`,
    "",
    "Use this Slack thread as reviewer context, but ground findings in the repository diff.",
    "Focus on bugs, regressions, missing tests, merge blockers, and risky behavior.",
    "Start with whether it looks mergeable. If there are findings, list them by severity",
    "with file and line references where possible. Keep the Slack response concise.",
    "",
    "Slack thread:",
    formatThread(thread),
  ].join("\n")
}
