# Visible Progress Notepad

Tier: LIGHT. Focused Slack visibility update inside existing handler.

Success criteria:
1. Assistant status loading messages stay within Slack's length limit.
2. Visible Slack progress message is posted and updated through `chat.update`.
3. Review heartbeat rotates visible status frames while Codex runs.
4. Full type/test gate passes.
5. Running tmux bot restarts on new code.

Evidence:
- Runtime log showed Slack rejected Assistant status: `bolt-app must be less than 51 characters [json-pointer:/loading_messages/0]`.
- Tests cover short Assistant loading messages, visible `chat.postMessage` + `chat.update`, and review progress frames.
- Full gate: `bun run verify` passed, 19 tests, 0 failures.
- Source audit found no credential-looking tokens; only literal `--ask-for-approval` flag strings.

Self-review: Assistant status remains best-effort; visible thread message is the reliable user-facing indicator in normal channels.
