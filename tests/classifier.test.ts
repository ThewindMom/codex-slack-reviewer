import { describe, expect, test } from "bun:test"
import { classifyReviewIntent } from "../src/classifier"
import type { CodexRunner, CommandResult, SlackThread } from "../src/types"

const thread: SlackThread = {
  channel: "C123",
  threadTs: "1.0",
  requester: "U123",
  messages: [{ user: "U123", text: "@codex can this be merged?", ts: "1.0" }],
}

describe("classifyReviewIntent", () => {
  test("returns a review request when Codex emits review JSON", async () => {
    const runner = fakeRunner({
      exitCode: 0,
      stdout: '{"kind":"review_request","reason":"asks if mergeable","target":"current branch"}',
      stderr: "",
    })

    const intent = await classifyReviewIntent(
      runner,
      { CODEX_REPO_PATH: "/repo", CLASSIFICATION_MODEL: undefined },
      thread,
    )

    expect(intent).toEqual({
      kind: "review_request",
      reason: "asks if mergeable",
      target: "current branch",
    })
  })

  test("runs Codex from the configured repo without sandbox overrides", async () => {
    const calls: string[][] = []
    const runner: CodexRunner = {
      async run(args, _input) {
        calls.push([...args])
        return { exitCode: 0, stdout: '{"kind":"ignore","reason":"status only"}', stderr: "" }
      },
    }

    await classifyReviewIntent(
      runner,
      { CODEX_REPO_PATH: "/poolpm-ai", CLASSIFICATION_MODEL: "gpt-test" },
      thread,
    )

    expect(calls[0]).toEqual([
      "--cd",
      "/poolpm-ai",
      "--model",
      "gpt-test",
      "exec",
      "-",
    ])
  })
})

function fakeRunner(result: CommandResult): CodexRunner {
  return {
    async run(_args, _input) {
      return result
    },
  }
}
