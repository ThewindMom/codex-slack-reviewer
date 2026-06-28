import type { AppConfig } from "./config"
import { reviewPrompt } from "./prompts"
import type { CodexRunner, CodexRunOptions, ReviewOutcome, SlackThread } from "./types"
import { classifyReviewIntent } from "./classifier"

export async function handleThreadReview(
  runner: CodexRunner,
  config: Pick<AppConfig, "CODEX_REPO_PATH" | "CODEX_BASE_REF" | "CLASSIFICATION_MODEL" | "REVIEW_MODEL">,
  thread: SlackThread,
): Promise<ReviewOutcome> {
  const intent = await classifyReviewIntent(runner, config, thread)
  switch (intent.kind) {
    case "ignore":
      return { kind: "ignored", reason: intent.reason }
    case "review_request":
      return runCodexReview(runner, config, thread, intent.target)
    default:
      return assertNever(intent)
  }
}

export async function runCodexReview(
  runner: CodexRunner,
  config: Pick<AppConfig, "CODEX_REPO_PATH" | "CODEX_BASE_REF" | "REVIEW_MODEL">,
  thread: SlackThread,
  target: string,
  options: CodexRunOptions = {},
): Promise<ReviewOutcome> {
  const args = [
    "--cd",
    config.CODEX_REPO_PATH,
    ...(config.REVIEW_MODEL ? ["--model", config.REVIEW_MODEL] : []),
    "exec",
    "-",
  ]
  const result = await runner.run(args, reviewPrompt(thread, config.CODEX_BASE_REF, target), options)
  if (result.exitCode !== 0) {
    return { kind: "failed", reason: result.stderr || "Codex review failed" }
  }
  return {
    kind: "reviewed",
    target,
    review: result.stdout.trim() || "Codex completed the review without output.",
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled intent: ${JSON.stringify(value)}`)
}
