import { describe, expect, test } from "bun:test"
import { readSlackThread, requesterMention } from "../src/slack"

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
