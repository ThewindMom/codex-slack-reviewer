import { describe, expect, test } from "bun:test"
import {
  clearAssistantStatus,
  readSlackThread,
  formatCodexOutputProgress,
  formatMarkdownForSlack,
  formatOutcome,
  postProgressMessage,
  requesterMention,
  reviewStatusMessages,
  setAssistantStatus,
  updateProgressMessage,
} from "../src/slack"

describe("requesterMention", () => {
  test("formats a Slack user id as a mention", () => {
    expect(requesterMention({ requester: "U123" })).toBe("<@U123>")
  })

  test("uses a neutral label when Slack did not provide a user", () => {
    expect(requesterMention({ requester: "unknown" })).toBe("Review result")
  })
})

describe("readSlackThread", () => {
  test("uses only the message that mentioned the bot", async () => {
    let repliesCalled = false
    const client = {
      conversations: {
        async replies(_args: { readonly channel: string; readonly ts: string; readonly limit: number }) {
          repliesCalled = true
          return {
            messages: [
              { user: "U999", text: "older context that should be excluded", ts: "0.9" },
              { user: "U123", text: "@codex can this merge?", ts: "1.0" },
            ],
          }
        },
      },
    }

    const thread = await readSlackThread(
      client,
      { MAX_THREAD_MESSAGES: 40 },
      {
        channel: "C123",
        user: "U123",
        text: "@codex can this merge?",
        ts: "1.0",
        thread_ts: "0.9",
      },
    )

    expect(repliesCalled).toBe(false)
    expect(thread.messages).toEqual([{ user: "U123", text: "@codex can this merge?", ts: "1.0" }])
    expect(thread.threadTs).toBe("0.9")
  })
})

describe("assistant status", () => {
  test("sets rotating assistant status messages", async () => {
    const calls: { readonly method: string; readonly args: Record<string, unknown> }[] = []
    const client = {
      async apiCall(method: string, args: Record<string, unknown>) {
        calls.push({ method, args })
        return { ok: true }
      },
    }

    await setAssistantStatus(
      client,
      { channel: "C123", threadTs: "1.0" },
      "Codex is reviewing",
      reviewStatusMessages("fix/example", "origin/main"),
    )

    expect(calls).toEqual([
      {
        method: "assistant.threads.setStatus",
        args: {
          channel_id: "C123",
          thread_ts: "1.0",
          status: "Codex is reviewing",
          loading_messages: [
            "Switching branches",
            "Reviewing against origin/main",
            "Validating findings",
            "Preparing summary",
          ],
        },
      },
    ])
  })

  test("keeps assistant loading messages within Slack's length limit", () => {
    expect(reviewStatusMessages("fix/very-long-branch-name-that-would-break-slack", "origin/main")).toEqual([
      "Switching branches",
      "Reviewing against origin/main",
      "Validating findings",
      "Preparing summary",
    ])
    expect(
      reviewStatusMessages("fix/very-long-branch-name-that-would-break-slack", "origin/main").every(
        (message) => message.length < 51,
      ),
    ).toBe(true)
  })

  test("clears assistant status", async () => {
    const calls: { readonly method: string; readonly args: Record<string, unknown> }[] = []
    const client = {
      async apiCall(method: string, args: Record<string, unknown>) {
        calls.push({ method, args })
        return { ok: true }
      },
    }

    await clearAssistantStatus(client, { channel: "C123", threadTs: "1.0" })

    expect(calls[0]).toEqual({
      method: "assistant.threads.setStatus",
      args: {
        channel_id: "C123",
        thread_ts: "1.0",
        status: "",
        loading_messages: [],
      },
    })
  })

  test("ignores Slack assistant status API errors", async () => {
    const client = {
      async apiCall(_method: string, _args: Record<string, unknown>) {
        throw new Error("method_not_supported_for_channel")
      },
    }

    await expect(
      setAssistantStatus(client, { channel: "C123", threadTs: "1.0" }, "Codex is working", [
        "Reviewing",
      ]),
    ).resolves.toBeUndefined()
  })
})

describe("visible progress messages", () => {
  test("posts and updates a visible Slack progress message", async () => {
    const calls: { readonly method: string; readonly args: Record<string, unknown> }[] = []
    const client = {
      async apiCall(method: string, args: Record<string, unknown>) {
        calls.push({ method, args })
        return { channel: "C123", ts: "2.0" }
      },
    }

    const message = await postProgressMessage(
      client,
      { channel: "C123", threadTs: "1.0" },
      "Codex is checking...",
    )
    await updateProgressMessage(client, message, "Codex is still reviewing...")

    expect(calls).toEqual([
      {
        method: "chat.postMessage",
        args: { channel: "C123", thread_ts: "1.0", text: "Codex is checking..." },
      },
      {
        method: "chat.update",
        args: { channel: "C123", ts: "2.0", text: "Codex is still reviewing..." },
      },
    ])
  })

  test("formats streamed Codex output as the visible progress indicator", () => {
    expect(
      formatCodexOutputProgress({
        mention: "<@U123>",
        target: "fix/example",
        baseRef: "origin/main",
        output: "git fetch origin fix/example\nrunning docker compose",
        timestamp: "2026-06-28T12:00:00.000Z",
        spinner: "|",
      }),
    ).toBe(
      [
        "<@U123> review request detected (fix/example).",
        "| Streaming Codex output while reviewing against `origin/main`.",
        "Last update: 2026-06-28T12:00:00.000Z",
        "```",
        "git fetch origin fix/example\nrunning docker compose",
        "```",
      ].join("\n"),
    )
  })

  test("formats empty and fenced Codex output safely", () => {
    expect(
      formatCodexOutputProgress({
        mention: "<@U123>",
        target: "fix/example",
        baseRef: "origin/main",
        output: "```ts\nconst value = true\n```",
        timestamp: "2026-06-28T12:00:00.000Z",
        spinner: "-",
      }),
    ).toContain("'''ts\nconst value = true\n'''")
    expect(
      formatCodexOutputProgress({
        mention: "<@U123>",
        target: "fix/example",
        baseRef: "origin/main",
        output: "",
        timestamp: "2026-06-28T12:00:00.000Z",
        spinner: "-",
      }),
    ).toContain("Codex started. Waiting for output...")
  })
})

describe("formatMarkdownForSlack", () => {
  test("converts common Codex Markdown into Slack mrkdwn", () => {
    const markdown = [
      "# Merge readiness",
      "",
      "**Verdict:** [Needs changes](https://example.com/review)",
      "- **P1** Fix `quoteTotal`",
    ].join("\n")

    expect(formatMarkdownForSlack(markdown)).toBe(
      [
        "*Merge readiness*",
        "",
        "*Verdict:* <https://example.com/review|Needs changes>",
        "- *P1* Fix `quoteTotal`",
      ].join("\n"),
    )
  })

  test("preserves fenced code blocks exactly", () => {
    const markdown = ["```ts", "const value = \"**not bold**\"", "```"].join("\n")

    expect(formatMarkdownForSlack(markdown)).toBe(markdown)
  })

  test("preserves inline code spans exactly", () => {
    expect(formatMarkdownForSlack("Check `**raw**` then **bold**")).toBe(
      "Check `**raw**` then *bold*",
    )
  })
})

describe("formatOutcome", () => {
  test("formats reviewed Codex Markdown for Slack", () => {
    expect(
      formatOutcome({
        kind: "reviewed",
        target: "fix/example",
        review: "## Findings\n\n**P1:** [Fix this](https://example.com)",
      }),
    ).toBe("*Codex review for fix/example:*\n\n*Findings*\n\n*P1:* <https://example.com|Fix this>")
  })
})
