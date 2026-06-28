# Branch Switch Prompt Notepad

Tier: LIGHT. Focused review prompt update only; classification prompt intentionally unchanged after user correction.

Success criteria:
1. RED/GREEN test proves review prompt instructs switching to requested branch before review.
2. Full type/test gate passes.
3. Classifier smoke still identifies branch review request and target.
4. Running tmux bot restarts on new prompt.

Evidence:
- RED: `bun test tests/prompts.test.ts` failed before prompt update because review prompt did not contain `Switch to the requested branch before reviewing`.
- GREEN targeted: `bun test tests/prompts.test.ts` passed, 2 tests.
- Full gate: `bun run verify` passed, 9 tests, 0 failures.
- Classifier smoke: `@codex please review branch fix/dxf-measurement-dirty-flag against main` returned `kind: review_request` with target mentioning `fix/dxf-measurement-dirty-flag`.
- Prompt print confirmed review prompt contains branch switching instruction and still includes origin/main, ultrawork, Docker Compose validation, browser QA, and trigger message.

Self-review: classification prompt was not modified; only `reviewPrompt` and prompt tests changed.
