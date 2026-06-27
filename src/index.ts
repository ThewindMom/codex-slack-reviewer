import { App } from "@slack/bolt"
import { loadConfig } from "./config"
import { ProcessCodexRunner } from "./codex"
import { handleThreadReview } from "./reviewer"
import { canHandleEvent, formatOutcome, readSlackThread } from "./slack"

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
  await say({ text: "Checking whether this needs a Codex review...", thread_ts: thread.threadTs })
  const outcome = await handleThreadReview(runner, config, thread)
  await say({ text: formatOutcome(outcome), thread_ts: thread.threadTs })
})

await app.start()
process.stdout.write("codex-slack-reviewer is running in Slack Socket Mode\n")
