# Slack Markdown Formatting Notepad

Tier: LIGHT. Contained output formatting change in final Slack review rendering.

Success criteria:
1. RED/GREEN tests cover converting common Codex Markdown to Slack mrkdwn.
2. Headings, bold, and Markdown links convert to Slack-friendly forms.
3. Inline code spans and fenced code blocks are preserved exactly.
4. Final reviewed outcome uses formatted review text.
5. Full verify passes and live bot restarts.

Evidence:
- RED: `bun test tests/slack.test.ts` first failed because `formatMarkdownForSlack` was missing; a follow-up RED caught inline code being reformatted inside backticks.
- GREEN targeted: `bun test tests/slack.test.ts` passed, 9 tests before final full gate.
- Full gate: `bun run verify` passed, 16 tests, 0 failures.
- Runtime smoke: `bun --eval ... formatMarkdownForSlack(...)` produced Slack mrkdwn with `*Heading*`, `*Bold* <https://example.com|Link>`, preserved inline code, and preserved fenced code.
- Source audit: token-pattern scan found only literal `--ask-for-approval` flag strings.

Self-review: formatter is conservative and only handles common safe transformations outside code spans/fences.
