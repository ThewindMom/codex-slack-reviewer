import { App } from "@slack/bolt"
import { loadConfig } from "./config"
import { ProcessCodexRunner } from "./codex"
import { classifyReviewIntent } from "./classifier"
import { runCodexReview } from "./reviewer"
import {
  classificationStatusMessages,
  clearAssistantStatus,
  canHandleEvent,
  formatCodexOutputProgress,
  formatOutcome,
  postProgressMessage,
  type ProgressMessage,
  readSlackThread,
  requesterMention,
  reviewStatusMessages,
  setAssistantStatus,
  updateProgressMessage,
  uploadBrowserQaVideos,
} from "./slack"

const STREAM_UPDATE_MS = 2_500
const STREAM_KEEPALIVE_MS = 30_000
const STREAM_TAIL_CHARS = 3_000
const STREAM_SPINNER_FRAMES = ["-", "\\", "|", "/"] as const

const config = loadConfig(process.env)
const runner = new ProcessCodexRunner(config.CODEX_BIN)

const app = new App({
  token: config.SLACK_BOT_TOKEN,
  appToken: config.SLACK_APP_TOKEN,
  socketMode: true,
})

app.event("app_mention", async ({ event, client, say }) => {
  if (!canHandleEvent(config, event)) return
  const thread = await readSlackThread(client, config, event)
  const mention = requesterMention(thread)
  let progress: ProgressMessage | undefined
  try {
    await setAssistantStatus(
      client,
      thread,
      "Codex is checking this request",
      classificationStatusMessages(),
    )
    progress = await postProgressMessage(
      client,
      thread,
      `${mention} Codex is checking whether this is a review request...`,
    )
    if (!progress) {
      await say({
        text: `${mention} Codex is checking whether this is a review request...`,
        thread_ts: thread.threadTs,
      })
    }

    const intent = await classifyReviewIntent(runner, config, thread)
    switch (intent.kind) {
      case "ignore":
        await updateOrSay(
          client,
          say,
          progress,
          thread.threadTs,
          `${mention} not treating this as a review request: ${intent.reason}`,
        )
        return
      case "review_request": {
        await setAssistantStatus(
          client,
          thread,
          `Codex is reviewing ${intent.target}`,
          reviewStatusMessages(intent.target, config.CODEX_BASE_REF),
        )
        await updateOrSay(
          client,
          say,
          progress,
          thread.threadTs,
          formatCodexOutputProgress({
            mention,
            target: intent.target,
            baseRef: config.CODEX_BASE_REF,
            output: "",
            timestamp: timestamp(),
            spinner: STREAM_SPINNER_FRAMES[0],
          }),
        )
        const streamer = createCodexOutputStreamer({
          client,
          progress,
          mention,
          target: intent.target,
          baseRef: config.CODEX_BASE_REF,
        })
        let outcome: Awaited<ReturnType<typeof runCodexReview>>
        try {
          outcome = await runCodexReview(runner, config, thread, intent.target, {
            onOutput: streamer.onOutput,
          })
        } finally {
          await streamer.stop()
        }
        await updateOrSay(
          client,
          say,
          progress,
          thread.threadTs,
          `${mention}\n\n${formatOutcome(outcome)}`,
        )
        if (outcome.kind === "reviewed") {
          await uploadBrowserQaVideos(client, thread, outcome.review)
        }
        return
      }
      default:
        assertNever(intent)
    }
  } finally {
    await clearAssistantStatus(client, thread)
  }
})

await app.start()
process.stdout.write("codex-slack-reviewer is running in Slack Socket Mode\n")

function assertNever(value: never): never {
  throw new Error(`Unhandled intent: ${JSON.stringify(value)}`)
}

type Say = (args: { readonly text: string; readonly thread_ts: string }) => Promise<unknown>

async function updateOrSay(
  client: Parameters<typeof updateProgressMessage>[0],
  say: Say,
  progress: ProgressMessage | undefined,
  threadTs: string,
  text: string,
): Promise<void> {
  if (progress) {
    await updateProgressMessage(client, progress, text)
    return
  }
  await say({ text, thread_ts: threadTs })
}

type CodexOutputStreamerInput = {
  readonly client: Parameters<typeof updateProgressMessage>[0]
  readonly progress: ProgressMessage | undefined
  readonly mention: string
  readonly target: string
  readonly baseRef: string
}

type CodexOutputStreamer = {
  readonly onOutput: (output: { readonly chunk: string }) => void
  readonly stop: () => Promise<void>
}

function createCodexOutputStreamer(input: CodexOutputStreamerInput): CodexOutputStreamer {
  const { client, progress } = input
  let output = ""
  let updateScheduled = false
  let updateTimer: ReturnType<typeof setTimeout> | undefined
  let spinnerIndex = 0
  const keepaliveTimer = setInterval(() => {
    void flush({ force: true })
  }, STREAM_KEEPALIVE_MS)
  keepaliveTimer.unref?.()

  async function flush(options: { readonly force: boolean } = { force: false }): Promise<void> {
    updateTimer = undefined
    updateScheduled = false
    if (!progress || (!options.force && !output.trim())) return
    const spinner = STREAM_SPINNER_FRAMES[spinnerIndex % STREAM_SPINNER_FRAMES.length] ?? "-"
    spinnerIndex += 1
    await updateProgressMessage(
      client,
      progress,
      formatCodexOutputProgress({
        ...input,
        output: output.slice(-STREAM_TAIL_CHARS),
        timestamp: timestamp(),
        spinner,
      }),
    )
  }

  return {
    onOutput({ chunk }) {
      output += chunk
      if (updateScheduled) return
      updateScheduled = true
      updateTimer = setTimeout(() => {
        void flush()
      }, STREAM_UPDATE_MS).unref?.()
    },
    async stop() {
      clearInterval(keepaliveTimer)
      if (updateTimer) {
        clearTimeout(updateTimer)
        updateTimer = undefined
      }
      await flush()
    },
  }
}

function timestamp(): string {
  return new Date().toISOString()
}
