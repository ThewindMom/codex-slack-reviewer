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
})
