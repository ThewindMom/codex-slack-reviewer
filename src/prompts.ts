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
    "Do not review in the currently checked-out worktree and do not switch branches in it.",
    "Use a temporary Git worktree as the primary review checkout. Resolve the branch from",
    "the Slack classified target and trigger message, then run commands in this shape:",
    `git fetch origin ${target}`,
    "REVIEW_WORKTREE=$(mktemp -d -t codex-review-XXXXXX)",
    `git worktree add --detach \"$REVIEW_WORKTREE\" origin/${target}`,
    "cd \"$REVIEW_WORKTREE\"",
    "Run the review, validation, Docker Compose command, and browser QA from that temporary worktree.",
    "Before finishing, clean up with: cd - && git worktree remove \"$REVIEW_WORKTREE\" --force.",
    "Do not assume the currently checked-out branch is the branch to review.",
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
