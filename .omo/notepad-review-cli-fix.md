# Review CLI Fix Notepad

Tier: LIGHT. Narrow CLI invocation bug in `runCodexReview`.

Success criteria:
1. RED proof reproduces Slack error from `codex review --base origin/main -`.
2. Review runner uses a Codex command that accepts the prompt and avoids the base/prompt conflict.
3. Full verification passes.
4. Running tmux bot is restarted on fixed code.

Evidence:
- RED: `codex --cd /home/thewind/Projects/02_AbcGen/poolpm-ai --sandbox read-only --ask-for-approval never review --base origin/main -` returned `error: the argument '--base <BRANCH>' cannot be used with '[PROMPT]'`.
- Failed alternative: prompt argument with `codex review --base origin/main '...'` also returned the same error.
- Working smoke: `printf 'Smoke test only...' | timeout 25s codex --cd /home/thewind/Projects/02_AbcGen/poolpm-ai --sandbox read-only --ask-for-approval never exec -` reached Codex and returned `OK`.
- Mocked runner: review args are `--cd /repo --sandbox read-only --ask-for-approval never exec -`; stdin prompt contains `origin/main`, Slack trigger text, and Docker Compose validation text.
- Full gate: `bun run verify` passed, 8 tests, 0 failures.

Self-review: review prompt still instructs reviewing against `CODEX_BASE_REF`; only transport changed from broken `codex review --base ... -` to supported `codex exec -`.
