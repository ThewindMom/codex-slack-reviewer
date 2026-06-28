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

  test("requires reviewing the requested branch from a temporary worktree", () => {
    const prompt = reviewPrompt(thread, "origin/main", "fix/dxf-measurement-dirty-flag")

    expect(prompt).toContain("Use a temporary Git worktree as the primary review checkout")
    expect(prompt).toContain("fix/dxf-measurement-dirty-flag")
    expect(prompt).toContain("git fetch origin fix/dxf-measurement-dirty-flag")
    expect(prompt).toContain(
      'git worktree add --detach "$REVIEW_WORKTREE" origin/fix/dxf-measurement-dirty-flag',
    )
    expect(prompt).toContain("Do not assume the currently checked-out branch is the branch to review")
    expect(prompt).toContain("against origin/main")
  })

  test("forbids reviewing in the original checkout", () => {
    const prompt = reviewPrompt(thread, "origin/main", "fix/dxf-measurement-dirty-flag")

    expect(prompt).toContain("Do not review in the currently checked-out worktree")
    expect(prompt).toContain('git worktree remove "$REVIEW_WORKTREE" --force')
  })
})
