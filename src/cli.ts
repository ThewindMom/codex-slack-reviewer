import { loadCodexConfig } from "./config"
import { ProcessCodexRunner } from "./codex"
import { classifyReviewIntent } from "./classifier"
import type { SlackThread } from "./types"

const command = process.argv[2]

if (command !== "classify") {
  process.stderr.write("Usage: bun run src/cli.ts classify < message.txt\n")
  process.exit(2)
}

const text = await Bun.stdin.text()
const config = loadCodexConfig(process.env)
const runner = new ProcessCodexRunner(config.CODEX_BIN)
const thread: SlackThread = {
  channel: "cli",
  threadTs: "cli",
  requester: "cli",
  messages: [{ user: "cli", text, ts: new Date(0).toISOString() }],
}

process.stdout.write(`${JSON.stringify(await classifyReviewIntent(runner, config, thread), null, 2)}\n`)
