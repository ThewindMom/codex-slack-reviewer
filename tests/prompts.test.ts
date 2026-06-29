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
    expect(prompt).toContain(
      'docker compose -p "$REVIEW_COMPOSE_PROJECT" down -v && docker compose -p "$REVIEW_COMPOSE_PROJECT" up --build -d',
    )
    expect(prompt).toContain("browser QA")
    expect(prompt).toContain("use the project's dev login")
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

  test("requires latest-commit focus plus whole-branch merge readiness", () => {
    const prompt = reviewPrompt(thread, "origin/main", "fix/dxf-measurement-dirty-flag")

    expect(prompt).toContain("Review the latest commit or commits")
    expect(prompt).toContain("then review the full branch diff against origin/main")
    expect(prompt).toContain("branch as a whole")
    expect(prompt).toContain("branch-wide regressions")
  })

  test("forbids reviewing in the original checkout", () => {
    const prompt = reviewPrompt(thread, "origin/main", "fix/dxf-measurement-dirty-flag")

    expect(prompt).toContain("Do not review in the currently checked-out worktree")
    expect(prompt).toContain('git worktree remove "$REVIEW_WORKTREE" --force')
  })

  test("requires isolated Docker Compose project and port handling", () => {
    const prompt = reviewPrompt(thread, "origin/main", "fix/dxf-measurement-dirty-flag")

    expect(prompt).toContain("active developer stack cannot be stopped")
    expect(prompt).toContain("REVIEW_COMPOSE_PROJECT")
    expect(prompt).toContain("isolates Compose containers, volumes, and networks")
    expect(prompt).toContain("docker compose -p alone is not sufficient")
    expect(prompt).toContain("container_name")
    expect(prompt).toContain("temporary Compose")
    expect(prompt).toContain("unique review container names")
    expect(prompt).toContain("If host ports conflict with another running poolpm stack")
    expect(prompt).toContain("temporary Compose override")
  })

  test("requires polling catalog-etl before declaring Docker stack failure", () => {
    const prompt = reviewPrompt(thread, "origin/main", "fix/dxf-measurement-dirty-flag")

    expect(prompt).toContain("catalog-etl can run for a long time on a cold-volume rebuild")
    expect(prompt).toContain("dependent services may")
    expect(prompt).toContain("remain Created until it exits")
    expect(prompt).toContain('docker compose -p "$REVIEW_COMPOSE_PROJECT" logs catalog-etl')
    expect(prompt).toContain('docker compose -p "$REVIEW_COMPOSE_PROJECT" ps repeatedly')
  })

  test("requires Browser QA video artifact for Slack upload", () => {
    const prompt = reviewPrompt(thread, "origin/main", "fix/dxf-measurement-dirty-flag")

    expect(prompt).toContain("record a short video of the end-to-end validation flow")
    expect(prompt).toContain("Save the video artifact")
    expect(prompt).toContain("verify the video is playable")
    expect(prompt).toContain("not a near-empty recording")
    expect(prompt).toContain("Browser QA video artifact: /absolute/path/to/video.webm")
    expect(prompt).toContain("The Slack bot will upload")
    expect(prompt).toContain("same Slack thread")
  })
})
