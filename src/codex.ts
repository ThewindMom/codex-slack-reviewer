import { spawn } from "node:child_process"
import type { CodexRunner, CodexRunOptions, CommandResult } from "./types"

export class ProcessCodexRunner implements CodexRunner {
  readonly #bin: string

  constructor(bin: string) {
    this.#bin = bin
  }

  run(args: readonly string[], input: string, options: CodexRunOptions = {}): Promise<CommandResult> {
    return new Promise((resolve, reject) => {
      const child = spawn(this.#bin, [...args], {
        stdio: ["pipe", "pipe", "pipe"],
      })
      const stdout: string[] = []
      const stderr: string[] = []

      child.stdout.setEncoding("utf8")
      child.stderr.setEncoding("utf8")
      child.stdout.on("data", (chunk: string) => {
        stdout.push(chunk)
        options.onOutput?.({ stream: "stdout", chunk })
      })
      child.stderr.on("data", (chunk: string) => {
        stderr.push(chunk)
        options.onOutput?.({ stream: "stderr", chunk })
      })
      child.on("error", reject)
      child.on("close", (code) =>
        resolve({
          exitCode: code ?? 1,
          stdout: stdout.join(""),
          stderr: stderr.join(""),
        }),
      )
      child.stdin.end(input)
    })
  }
}
