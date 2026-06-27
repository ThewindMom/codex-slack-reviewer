# Trigger Message Only Notepad

Tier: LIGHT. Narrow Slack context-selection change plus prompt wording update.
Skills used: omo:programming for TypeScript changes; omo:git-master for commit/push workflow.

Success criteria:
1. RED/GREEN test proves Slack thread replies are excluded and only the triggering mention is used.
2. Prompt wording no longer claims the whole Slack thread is provided.
3. Full type/test gate passes and real CLI classification smoke still works.

Evidence:
- RED: `bun test tests/slack.test.ts` failed before production change because `readSlackThread` called `conversations.replies`.
- GREEN targeted: `bun test tests/slack.test.ts` passed after production change.
- Full gate: `bun run verify` passed, 8 tests, 0 failures.
- Real CLI smoke: `printf ... 'Can this be merged into origin/main?' | bun run classify` returned `kind: review_request`.
- Source audit: `rg` found no real token patterns; only literal `--ask-for-approval` flag strings.

Self-review: data sent to Codex now contains exactly one message from the `app_mention` event while preserving `thread_ts` for replies in Slack.
Cleanup: no servers, tmux sessions, browser contexts, or Docker resources started by this task.
