import { describe, expect, test } from "bun:test"
import { reviewPrompt } from "../src/prompts"
import type { SlackThread } from "../src/types"

const thread: SlackThread = {
  channel: "C123",
  threadTs: "1.0",
  requester: "U123",
  messages: [{ user: "U123", text: "@codex can this merge?", ts: "1.0" }],
}

describe("reviewPrompt", () => {
  test("requires ultrawork, Docker Compose validation, and browser QA", () => {
    const prompt = reviewPrompt(thread, "origin/main", "current branch")

    expect(prompt).toContain("ultrawork")
    expect(prompt).toContain("docker compose down -v && docker compose up --build -d")
    expect(prompt).toContain("browser QA")
  })
})
