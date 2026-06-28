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

  test("requires switching to the branch requested in Slack before review", () => {
    const prompt = reviewPrompt(thread, "origin/main", "fix/dxf-measurement-dirty-flag")

    expect(prompt).toContain("Switch to the requested branch before reviewing")
    expect(prompt).toContain("fix/dxf-measurement-dirty-flag")
    expect(prompt).toContain("Do not assume the currently checked-out branch is the branch to review")
    expect(prompt).toContain("against origin/main")
  })

  test("handles branches already checked out in another worktree", () => {
    const prompt = reviewPrompt(thread, "origin/main", "fix/dxf-measurement-dirty-flag")

    expect(prompt).toContain("If Git refuses to switch because the branch is checked out in another worktree")
    expect(prompt).toContain("origin/fix/dxf-measurement-dirty-flag")
    expect(prompt).toContain("temporary worktree")
  })
})
