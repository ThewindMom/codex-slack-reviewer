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
  readSlackThread,
  requesterMention,
  reviewStatusMessages,
  setAssistantStatus,
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
  try {
    await setAssistantStatus(
      client,
      thread,
      "Codex is checking this request",
      classificationStatusMessages(),
    )
    await say({
      text: `${mention} checking whether this is a review request...`,
      thread_ts: thread.threadTs,
    })

    const intent = await classifyReviewIntent(runner, config, thread)
    switch (intent.kind) {
      case "ignore":
        await say({
          text: `${mention} not treating this as a review request: ${intent.reason}`,
          thread_ts: thread.threadTs,
        })
        return
      case "review_request": {
        await setAssistantStatus(
          client,
          thread,
          `Codex is reviewing ${intent.target}`,
          reviewStatusMessages(intent.target, config.CODEX_BASE_REF),
        )
        await say({
          text: `${mention} review request detected (${intent.target}). Running Codex against ${config.CODEX_BASE_REF}...`,
          thread_ts: thread.threadTs,
        })
        const outcome = await runCodexReview(runner, config, thread, intent.target)
        await say({ text: `${mention}\n\n${formatOutcome(outcome)}`, thread_ts: thread.threadTs })
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
