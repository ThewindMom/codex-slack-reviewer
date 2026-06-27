import { spawn } from "node:child_process"
import type { CodexRunner, CommandResult } from "./types"

export class ProcessCodexRunner implements CodexRunner {
  readonly #bin: string

  constructor(bin: string) {
    this.#bin = bin
  }

  run(args: readonly string[], input: string): Promise<CommandResult> {
    return new Promise((resolve, reject) => {
      const child = spawn(this.#bin, [...args], {
        stdio: ["pipe", "pipe", "pipe"],
      })
      const stdout: string[] = []
      const stderr: string[] = []

      child.stdout.setEncoding("utf8")
      child.stderr.setEncoding("utf8")
      child.stdout.on("data", (chunk: string) => stdout.push(chunk))
      child.stderr.on("data", (chunk: string) => stderr.push(chunk))
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
