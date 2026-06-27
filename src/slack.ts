import type { AppConfig } from "./config"
import type { ReviewOutcome, SlackMessage, SlackThread } from "./types"

type SlackClient = {
  conversations: {
    replies(args: {
      readonly channel: string
      readonly ts: string
      readonly limit: number
    }): Promise<{
      readonly messages?: readonly {
        readonly user?: string
        readonly username?: string
        readonly bot_id?: string
        readonly text?: string
        readonly ts?: string
      }[]
    }>
  }
}

type SlackMentionEvent = {
  readonly channel: string
  readonly user?: string
  readonly text?: string
  readonly ts: string
  readonly thread_ts?: string
}

export function canHandleEvent(
  config: Pick<AppConfig, "ALLOWED_SLACK_USER_IDS" | "ALLOWED_SLACK_CHANNEL_IDS">,
  event: SlackMentionEvent,
): boolean {
  const userAllowed =
    config.ALLOWED_SLACK_USER_IDS.length === 0 ||
    (event.user ? config.ALLOWED_SLACK_USER_IDS.includes(event.user) : false)
  const channelAllowed =
    config.ALLOWED_SLACK_CHANNEL_IDS.length === 0 ||
    config.ALLOWED_SLACK_CHANNEL_IDS.includes(event.channel)
  return userAllowed && channelAllowed
}

export async function readSlackThread(
  client: SlackClient,
  config: Pick<AppConfig, "MAX_THREAD_MESSAGES">,
  event: SlackMentionEvent,
): Promise<SlackThread> {
  const threadTs = event.thread_ts ?? event.ts
  const response = await client.conversations.replies({
    channel: event.channel,
    ts: threadTs,
    limit: config.MAX_THREAD_MESSAGES,
  })
  const messages = (response.messages ?? []).flatMap(toSlackMessage)
  return {
    channel: event.channel,
    threadTs,
    requester: event.user ?? "unknown",
    messages:
      messages.length > 0
        ? messages
        : [{ user: event.user ?? "unknown", text: event.text ?? "", ts: event.ts }],
  }
}

export function formatOutcome(outcome: ReviewOutcome): string {
  switch (outcome.kind) {
    case "ignored":
      return `Not treating this as a review request: ${outcome.reason}`
    case "failed":
      return `Codex review failed: ${outcome.reason}`
    case "reviewed":
      return [`Codex review for ${outcome.target}:`, outcome.review].join("\n\n")
    default:
      return assertNever(outcome)
  }
}

function toSlackMessage(message: {
  readonly user?: string
  readonly username?: string
  readonly bot_id?: string
  readonly text?: string
  readonly ts?: string
}): readonly SlackMessage[] {
  if (!message.ts) return []
  return [
    {
      user: message.user ?? message.username ?? message.bot_id ?? "unknown",
      text: message.text ?? "",
      ts: message.ts,
    },
  ]
}

function assertNever(value: never): never {
  throw new Error(`Unhandled outcome: ${JSON.stringify(value)}`)
}
