import { describe, expect, test } from "bun:test"
import {
  clearAssistantStatus,
  readSlackThread,
  requesterMention,
  reviewStatusMessages,
  setAssistantStatus,
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
            "Switching to fix/example",
            "Reviewing changes against origin/main",
            "Validating findings",
            "Preparing the Slack summary",
          ],
        },
      },
    ])
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
