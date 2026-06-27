# Ultrawork Review Prompt Notepad

Tier: LIGHT. Narrow prompt-only behavior change in existing `reviewPrompt`.
Skills used: omo:programming for TypeScript changes; omo:git-master for commit/push workflow.

Success criteria:
1. RED/GREEN prompt test proves review prompt requires ultrawork, Docker Compose validation, and browser QA.
2. Full type/test gate passes.
3. Real CLI classification smoke test still detects a merge review request against poolpm-ai.

Evidence:
- RED: `bun test tests/prompts.test.ts` failed before production change because prompt did not contain `ultrawork`.
- GREEN targeted: `bun test tests/prompts.test.ts` passed after prompt update.
- Full gate: `bun run verify` passed, 7 tests, 0 failures.
- Real surface CLI smoke: `printf ... | CODEX_REPO_PATH=/home/thewind/Projects/02_AbcGen/poolpm-ai CODEX_BASE_REF=origin/main bun run classify` returned `kind: review_request`.
- Secret/source audit: `rg` only found literal `--ask-for-approval` strings, no real token patterns.

Self-review: diff is limited to prompt wording plus a focused prompt test; no runtime command behavior changed.
Cleanup: no servers, tmux sessions, browser contexts, or Docker resources started by this task.
