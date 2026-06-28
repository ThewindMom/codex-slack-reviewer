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
    "If the project supports Docker Compose, validate in an isolated Compose project so an",
    "active developer stack cannot be stopped, renamed, network-conflicted, or port-conflicted.",
    "Use commands in this shape from the temporary review worktree:",
    `REVIEW_COMPOSE_PROJECT=$(printf 'poolpm-codex-${target}' | tr -cs '[:alnum:]' '-' | tr '[:upper:]' '[:lower:]' | cut -c1-48)`,
    "docker compose -p \"$REVIEW_COMPOSE_PROJECT\" down -v && docker compose -p \"$REVIEW_COMPOSE_PROJECT\" up --build -d.",
    "The -p project name is required because it isolates Compose containers, volumes, and networks.",
    "Important: docker compose -p alone is not sufficient when compose files contain fixed",
    "container_name values. Before starting the review stack, inspect the compose files or",
    "docker compose config for container_name entries. If any exist, create a temporary Compose",
    "override file that gives those services unique review container names based on",
    "$REVIEW_COMPOSE_PROJECT, and run docker compose with that override file included.",
    "Do not remove, rename, stop, or reuse containers from another active poolpm stack.",
    "If host ports conflict with another running poolpm stack, do not stop that stack. Pick free",
    "high ports through project-supported env vars or a temporary Compose override, then report",
    "which review ports/browser URL were used.",
    "After docker compose down -v && docker compose up --build -d, keep waiting and polling.",
    "catalog-etl can run for a long time on a cold-volume rebuild, and dependent services may",
    "remain Created until it exits. Do not treat that as failure unless catalog-etl exits non-zero,",
    "logs show a real error loop, or there is no progress after a long timeout. Check",
    "docker compose -p \"$REVIEW_COMPOSE_PROJECT\" logs catalog-etl and",
    "docker compose -p \"$REVIEW_COMPOSE_PROJECT\" ps repeatedly before declaring the stack unreachable.",
    "Run browser QA against the rebuilt app when there is a browser-facing surface, and",
    "use the project's dev login so authentication does not block Browser QA.",
    "include any validation gaps in the final review if Docker or browser QA cannot be run.",
    "",
    "Slack trigger message:",
    formatThread(thread),
  ].join("\n")
}
