import { App } from "@slack/bolt"
import { loadConfig } from "./config"
import { ProcessCodexRunner } from "./codex"
import { classifyReviewIntent } from "./classifier"
import { runCodexReview } from "./reviewer"
import {
  classificationStatusMessages,
  clearAssistantStatus,
  canHandleEvent,
  formatOutcome,
  formatVisibleReviewProgress,
  postProgressMessage,
  type ProgressMessage,
  readSlackThread,
  requesterMention,
  reviewStatusMessages,
  setAssistantStatus,
  updateProgressMessage,
} from "./slack"

const PROGRESS_HEARTBEAT_MS = 5_000

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
          formatVisibleReviewProgress({
            mention,
            target: intent.target,
            baseRef: config.CODEX_BASE_REF,
            frameIndex: 0,
          }),
        )
        const stopHeartbeat = startProgressHeartbeat(
          {
            client,
            progress,
            mention,
            target: intent.target,
            baseRef: config.CODEX_BASE_REF,
          },
        )
        let outcome: Awaited<ReturnType<typeof runCodexReview>>
        try {
          outcome = await runCodexReview(runner, config, thread, intent.target)
        } finally {
          stopHeartbeat()
        }
        await updateOrSay(
          client,
          say,
          progress,
          thread.threadTs,
          `${mention}\n\n${formatOutcome(outcome)}`,
        )
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

type ProgressHeartbeatInput = {
  readonly client: Parameters<typeof updateProgressMessage>[0]
  readonly progress: ProgressMessage | undefined
  readonly mention: string
  readonly target: string
  readonly baseRef: string
}

function startProgressHeartbeat(input: ProgressHeartbeatInput): () => void {
  const { client, progress } = input
  if (!progress) return () => {}
  let index = 1
  const timer = setInterval(() => {
    const text = formatVisibleReviewProgress({ ...input, frameIndex: index })
    index += 1
    void updateProgressMessage(client, progress, text)
  }, PROGRESS_HEARTBEAT_MS)
  timer.unref?.()
  return () => clearInterval(timer)
}
