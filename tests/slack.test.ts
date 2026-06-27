import { describe, expect, test } from "bun:test"
import { requesterMention } from "../src/slack"

describe("requesterMention", () => {
  test("formats a Slack user id as a mention", () => {
    expect(requesterMention({ requester: "U123" })).toBe("<@U123>")
  })

  test("uses a neutral label when Slack did not provide a user", () => {
    expect(requesterMention({ requester: "unknown" })).toBe("Review result")
  })
})
