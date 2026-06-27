export type ReviewIntent =
  | {
      readonly kind: "review_request"
      readonly reason: string
      readonly target: string
    }
  | {
      readonly kind: "ignore"
      readonly reason: string
    }

export type SlackMessage = {
  readonly user: string
  readonly text: string
  readonly ts: string
}

export type SlackThread = {
  readonly channel: string
  readonly threadTs: string
  readonly requester: string
  readonly messages: readonly SlackMessage[]
}

export type CommandResult = {
  readonly exitCode: number
  readonly stdout: string
  readonly stderr: string
}

export interface CodexRunner {
  run(args: readonly string[], input: string): Promise<CommandResult>
}

export type ReviewOutcome =
  | {
      readonly kind: "ignored"
      readonly reason: string
    }
  | {
      readonly kind: "reviewed"
      readonly target: string
      readonly review: string
    }
  | {
      readonly kind: "failed"
      readonly reason: string
    }
