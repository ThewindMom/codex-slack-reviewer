import { z } from "zod"
import type { AppConfig } from "./config"
import { classificationPrompt } from "./prompts"
import type { CodexRunner, ReviewIntent, SlackThread } from "./types"

const intentSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("review_request"),
    reason: z.string().min(1),
    target: z.string().min(1),
  }),
  z.object({
    kind: z.literal("ignore"),
    reason: z.string().min(1),
  }),
])

export class ClassificationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ClassificationError"
  }
}

export async function classifyReviewIntent(
  runner: CodexRunner,
  config: Pick<AppConfig, "CODEX_REPO_PATH" | "CLASSIFICATION_MODEL">,
  thread: SlackThread,
): Promise<ReviewIntent> {
  const args = [
    "--cd",
    config.CODEX_REPO_PATH,
    ...(config.CLASSIFICATION_MODEL ? ["--model", config.CLASSIFICATION_MODEL] : []),
    "exec",
    "-",
  ]
  const result = await runner.run(args, classificationPrompt(thread))
  if (result.exitCode !== 0) {
    throw new ClassificationError(result.stderr || "Codex classification failed")
  }
  const parsedJson = extractJsonObject(result.stdout)
  return intentSchema.parse(JSON.parse(parsedJson))
}

function extractJsonObject(text: string): string {
  const start = text.indexOf("{")
  const end = text.lastIndexOf("}")
  if (start < 0 || end <= start) {
    throw new ClassificationError("Codex classification did not return JSON")
  }
  return text.slice(start, end + 1)
}
