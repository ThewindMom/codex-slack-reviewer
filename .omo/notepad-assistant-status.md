# Assistant Status Notepad

Tier: LIGHT-to-medium. Focused Slack integration update inside the existing handler.

Success criteria:
1. Slack Assistant status helper calls `assistant.threads.setStatus` with rotating `loading_messages`.
2. Assistant status errors are best-effort and do not break reviews.
3. App handler sets status during classification and review, then clears status in `finally`.
4. Full type/test gate passes.
5. Running tmux bot restarts on the new code.

Evidence:
- Source research: Slack docs say `assistant.threads.setStatus` accepts `status`, `channel_id`, `thread_ts`, and optional `loading_messages`, and Slack rotates loading messages.
- Targeted tests: `bun test tests/slack.test.ts` passed, including set, clear, and error-ignore cases.
- Full gate: `bun run verify` passed, 12 tests, 0 failures.

Self-review: helper is best-effort and uses `client.apiCall` so unsupported Slack surfaces do not block the Codex review path.
