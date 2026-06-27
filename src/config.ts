import { z } from "zod"

const optionalCsv = z
  .string()
  .optional()
  .transform((value) =>
    value
      ? value
          .split(",")
          .map((item) => item.trim())
          .filter((item) => item.length > 0)
      : [],
  )

const codexEnvSchema = z.object({
  CODEX_REPO_PATH: z.string().min(1),
  CODEX_BASE_REF: z.string().min(1).default("origin/main"),
  CODEX_BIN: z.string().min(1).default("codex"),
  MAX_THREAD_MESSAGES: z.coerce.number().int().positive().max(200).default(40),
  CLASSIFICATION_MODEL: z.string().optional(),
  REVIEW_MODEL: z.string().optional(),
})

const envSchema = codexEnvSchema.extend({
  SLACK_BOT_TOKEN: z.string().min(1),
  SLACK_APP_TOKEN: z.string().min(1),
  ALLOWED_SLACK_USER_IDS: optionalCsv,
  ALLOWED_SLACK_CHANNEL_IDS: optionalCsv,
})

export type CodexConfig = z.infer<typeof codexEnvSchema>
export type AppConfig = z.infer<typeof envSchema>

export function loadCodexConfig(env: NodeJS.ProcessEnv): CodexConfig {
  return codexEnvSchema.parse(env)
}

export function loadConfig(env: NodeJS.ProcessEnv): AppConfig {
  return envSchema.parse(env)
}
