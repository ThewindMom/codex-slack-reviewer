import type { AppConfig } from "./config"
import type { ReviewOutcome, SlackThread } from "./types"

type SlackClient = {
  apiCall?: (method: string, args: Record<string, unknown>) => Promise<unknown>
  conversations?: unknown
}

export type ProgressMessage = {
  readonly channel: string
  readonly ts: string
}

export type CodexOutputProgressInput = {
  readonly mention: string
  readonly target: string
  readonly baseRef: string
  readonly output: string
  readonly timestamp: string
  readonly spinner: string
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

export async function postProgressMessage(
  client: SlackClient,
  thread: Pick<SlackThread, "channel" | "threadTs">,
  text: string,
): Promise<ProgressMessage | undefined> {
  if (!client.apiCall) return undefined
  try {
    const response = await client.apiCall("chat.postMessage", {
      channel: thread.channel,
      thread_ts: thread.threadTs,
      text,
    })
    return parseProgressMessage(response)
  } catch (error) {
    if (error instanceof Error) return undefined
    throw error
  }
}

export async function updateProgressMessage(
  client: SlackClient,
  message: ProgressMessage | undefined,
  text: string,
): Promise<void> {
  if (!client.apiCall || !message) return
  try {
    await client.apiCall("chat.update", {
      channel: message.channel,
      ts: message.ts,
      text,
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
    "Switching branches",
    `Reviewing against ${baseRef}`,
    "Validating findings",
    "Preparing summary",
  ]
}

export function formatCodexOutputProgress(input: CodexOutputProgressInput): string {
  return [
    `${input.mention} review request detected (${input.target}).`,
    `${input.spinner} Streaming Codex output while reviewing against \`${input.baseRef}\`.`,
    `Last update: ${input.timestamp}`,
    "```",
    formatSlackCodeBlockText(input.output),
    "```",
  ].join("\n")
}

function formatSlackCodeBlockText(text: string): string {
  const trimmed = text.trim()
  if (!trimmed) return "Codex started. Waiting for output..."
  return trimmed.replaceAll("```", "'''")
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

function parseProgressMessage(response: unknown): ProgressMessage | undefined {
  if (!response || typeof response !== "object") return undefined
  const values = response as Record<string, unknown>
  const channel = values["channel"]
  const ts = values["ts"]
  if (typeof channel !== "string" || typeof ts !== "string") return undefined
  return { channel, ts }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled outcome: ${JSON.stringify(value)}`)
}
