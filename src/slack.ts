import type { AppConfig } from "./config"
import type { ReviewOutcome, SlackThread } from "./types"

type SlackClient = {
  apiCall?: (method: string, args: Record<string, unknown>) => Promise<unknown>
  conversations?: unknown
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
  _client: SlackClient,
  _config: Pick<AppConfig, "MAX_THREAD_MESSAGES">,
  event: SlackMentionEvent,
): Promise<SlackThread> {
  const threadTs = event.thread_ts ?? event.ts
  return {
    channel: event.channel,
    threadTs,
    requester: event.user ?? "unknown",
    messages: [{ user: event.user ?? "unknown", text: event.text ?? "", ts: event.ts }],
  }
}

export async function setAssistantStatus(
  client: SlackClient,
  thread: Pick<SlackThread, "channel" | "threadTs">,
  status: string,
  loadingMessages: readonly string[],
): Promise<void> {
  if (!client.apiCall) return
  try {
    await client.apiCall("assistant.threads.setStatus", {
      channel_id: thread.channel,
      thread_ts: thread.threadTs,
      status,
      loading_messages: [...loadingMessages],
    })
  } catch (error) {
    if (error instanceof Error) return
    throw error
  }
}

export async function clearAssistantStatus(
  client: SlackClient,
  thread: Pick<SlackThread, "channel" | "threadTs">,
): Promise<void> {
  if (!client.apiCall) return
  try {
    await client.apiCall("assistant.threads.setStatus", {
      channel_id: thread.channel,
      thread_ts: thread.threadTs,
      status: "",
      loading_messages: [],
    })
  } catch (error) {
    if (error instanceof Error) return
    throw error
  }
}

export function classificationStatusMessages(): readonly string[] {
  return [
    "Reading the request",
    "Checking whether this needs a review",
    "Preparing Codex context",
  ]
}

export function reviewStatusMessages(target: string, baseRef: string): readonly string[] {
  return [
    `Switching to ${target}`,
    `Reviewing changes against ${baseRef}`,
    "Validating findings",
    "Preparing the Slack summary",
  ]
}

export function formatOutcome(outcome: ReviewOutcome): string {
  switch (outcome.kind) {
    case "ignored":
      return `Not treating this as a review request: ${outcome.reason}`
    case "failed":
      return `Codex review failed: ${outcome.reason}`
    case "reviewed":
      return [`*Codex review for ${outcome.target}:*`, formatMarkdownForSlack(outcome.review)].join(
        "\n\n",
      )
    default:
      return assertNever(outcome)
  }
}

export function formatMarkdownForSlack(markdown: string): string {
  const lines = markdown.split("\n")
  let inFence = false
  return lines
    .map((line) => {
      if (line.trimStart().startsWith("```")) {
        inFence = !inFence
        return line
      }
      if (inFence) return line
      return formatSlackLine(line)
    })
    .join("\n")
}

export function requesterMention(thread: Pick<SlackThread, "requester">): string {
  return thread.requester === "unknown" ? "Review result" : `<@${thread.requester}>`
}

function formatSlackLine(line: string): string {
  return splitInlineCode(formatHeading(line))
    .map((part) => (part.kind === "code" ? part.value : formatInlineSlackMarkdown(part.value)))
    .join("")
}

function formatHeading(line: string): string {
  const match = /^(#{1,6})\s+(.+)$/.exec(line)
  return match ? `*${match[2]}*` : line
}

function formatInlineSlackMarkdown(line: string): string {
  return line
    .replace(/\[([^\]]+)]\((https?:\/\/[^)\s]+)\)/g, "<$2|$1>")
    .replace(/\*\*([^*\n]+)\*\*/g, "*$1*")
}

function splitInlineCode(line: string): readonly { readonly kind: "code" | "text"; readonly value: string }[] {
  return line.split(/(`[^`]*`)/g).map((value) => ({
    kind: value.startsWith("`") && value.endsWith("`") ? "code" : "text",
    value,
  }))
}

function assertNever(value: never): never {
  throw new Error(`Unhandled outcome: ${JSON.stringify(value)}`)
}
