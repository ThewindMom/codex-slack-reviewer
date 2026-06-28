import { describe, expect, test } from "bun:test"
import { handleThreadReview, runCodexReview } from "../src/reviewer"
import type { CodexRunner, SlackThread } from "../src/types"

const thread: SlackThread = {
  channel: "C123",
  threadTs: "1.0",
  requester: "U123",
  messages: [{ user: "U123", text: "@codex review what got pushed", ts: "1.0" }],
}

describe("handleThreadReview", () => {
  test("does not run a review when classification says ignore", async () => {
    let callCount = 0
    const runner: CodexRunner = {
      async run(_args, _input) {
        callCount += 1
        return { exitCode: 0, stdout: '{"kind":"ignore","reason":"plain update"}', stderr: "" }
      },
    }

    const outcome = await handleThreadReview(runner, config(), thread)

    expect(outcome).toEqual({ kind: "ignored", reason: "plain update" })
    expect(callCount).toBe(1)
  })

  test("runs Codex review against origin main when classification asks for review", async () => {
    const calls: string[][] = []
    const runner: CodexRunner = {
      async run(args, _input) {
        calls.push([...args])
        if (calls.length === 1) {
          return {
            exitCode: 0,
            stdout:
              '{"kind":"review_request","reason":"asks for review","target":"current pushed work"}',
            stderr: "",
          }
        }
        return { exitCode: 0, stdout: "Looks mergeable. No blocking findings.", stderr: "" }
      },
    }

    const outcome = await handleThreadReview(runner, config(), thread)

    expect(calls[1]).toEqual([
      "--cd",
      "/poolpm-ai",
      "exec",
      "-",
    ])
    expect(outcome).toEqual({
      kind: "reviewed",
      target: "current pushed work",
      review: "Looks mergeable. No blocking findings.",
    })
  })

  test("streams Codex review output through the runner callback", async () => {
    const streamedChunks: string[] = []
    const runner: CodexRunner = {
      async run(_args, _input, options) {
        options?.onOutput?.({ stream: "stdout", chunk: "creating temp worktree\n" })
        options?.onOutput?.({ stream: "stderr", chunk: "docker compose building\n" })
        return { exitCode: 0, stdout: "Final review", stderr: "" }
      },
    }

    const outcome = await runCodexReview(runner, config(), thread, "fix/example", {
      onOutput: ({ chunk }) => streamedChunks.push(chunk),
    })

    expect(streamedChunks).toEqual(["creating temp worktree\n", "docker compose building\n"])
    expect(outcome).toEqual({ kind: "reviewed", target: "fix/example", review: "Final review" })
  })
})

function config() {
  return {
    CODEX_REPO_PATH: "/poolpm-ai",
    CODEX_BASE_REF: "origin/main",
    CLASSIFICATION_MODEL: undefined,
    REVIEW_MODEL: undefined,
  }
}
