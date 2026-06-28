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
  postProgressMessage,
  type ProgressMessage,
  readSlackThread,
  requesterMention,
  reviewStatusMessages,
  setAssistantStatus,
  updateProgressMessage,
  visibleReviewProgressFrames,
} from "./slack"

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
          `${mention} review request detected (${intent.target}). Running Codex against ${config.CODEX_BASE_REF}...`,
        )
        const stopHeartbeat = startProgressHeartbeat(
          client,
          progress,
          mention,
          visibleReviewProgressFrames(intent.target, config.CODEX_BASE_REF),
        )
        const outcome = await runCodexReview(runner, config, thread, intent.target)
        stopHeartbeat()
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

function startProgressHeartbeat(
  client: Parameters<typeof updateProgressMessage>[0],
  progress: ProgressMessage | undefined,
  mention: string,
  frames: readonly string[],
): () => void {
  if (!progress || frames.length === 0) return () => {}
  let index = 0
  const timer = setInterval(() => {
    const frame = frames[index % frames.length] ?? "Codex is still working..."
    index += 1
    void updateProgressMessage(client, progress, `${mention} ${frame}`)
  }, 12_000)
  timer.unref?.()
  return () => clearInterval(timer)
}
