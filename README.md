# Codex Slack Reviewer

Self-hosted Slack bot that listens for `@codex` mentions, asks Codex whether the
thread is actually requesting a code review, and only then runs a Codex review of
your configured repository against `origin/main`.

The intended first use case is a teammate posting an update like "pushed the
quote flow, can this merge?" in Slack. Plain status updates are ignored; review
or merge-readiness asks trigger Codex.

## How It Works

```text
Slack app mention
  -> read the current Slack thread
  -> codex exec classifies intent in read-only mode
  -> codex exec reviews against CODEX_BASE_REF when needed
  -> result is posted back into the Slack thread
```

This repository contains no credentials. Runtime secrets live in `.env`, which
is ignored by git.

## Requirements

- Bun
- Codex CLI installed and logged in on the host
- A Slack app with Socket Mode enabled

## Slack App Setup

Create a Slack app at <https://api.slack.com/apps> and enable Socket Mode.

Bot token scopes:

- `app_mentions:read`
- `channels:history`
- `groups:history`
- `im:history`
- `mpim:history`
- `chat:write`

Event subscriptions:

- `app_mention`

Create an app-level token with `connections:write`.

The bot also calls Slack's `assistant.threads.setStatus` while Codex is working.
Slack rotates the supplied loading messages as the visible thinking indicator.

## Local Setup

```sh
bun install
cp .env.example .env
```

Edit `.env`:

```sh
SLACK_BOT_TOKEN=xoxb-...
SLACK_APP_TOKEN=xapp-...
CODEX_REPO_PATH=/home/thewind/Projects/02_AbcGen/poolpm-ai
CODEX_BASE_REF=origin/main
```

Run it:

```sh
bun run start
```

Then mention the bot in Slack:

```text
@codex Cory pushed the lead proposal changes. Can this merge into main?
```

While Codex is working, Slack shows Assistant status updates such as checking the
request, switching to the requested branch, reviewing against `origin/main`, and
preparing the summary.

Final Codex review output is converted from common Markdown to Slack `mrkdwn`:
headings become bold lines, Markdown links become Slack links, bold syntax is
normalized, and code spans/fences are preserved.

## Safety Defaults

- Classification runs `codex exec` with `--sandbox read-only`.
- Review runs `codex exec` with `--sandbox read-only`.
- Working state is surfaced through Slack Assistant thread status updates.
- The bot reviews only the configured `CODEX_REPO_PATH`.
- Use `ALLOWED_SLACK_USER_IDS` and `ALLOWED_SLACK_CHANNEL_IDS` to restrict who
  can trigger reviews.
- The app never commits, pushes, or edits the target repository.

## Configuration

| Variable | Purpose |
| --- | --- |
| `SLACK_BOT_TOKEN` | Slack bot OAuth token (`xoxb-...`). |
| `SLACK_APP_TOKEN` | Slack app-level Socket Mode token (`xapp-...`). |
| `CODEX_REPO_PATH` | Repository Codex should review. |
| `CODEX_BASE_REF` | Base ref for review, default `origin/main`. |
| `CODEX_BIN` | Codex executable, default `codex`. |
| `ALLOWED_SLACK_USER_IDS` | Optional comma-separated allowlist. |
| `ALLOWED_SLACK_CHANNEL_IDS` | Optional comma-separated allowlist. |
| `MAX_THREAD_MESSAGES` | Max Slack thread messages to pass to Codex. |
| `CLASSIFICATION_MODEL` | Optional Codex model override for classification. |
| `REVIEW_MODEL` | Optional Codex model override for review. |

## Verification

```sh
bun run verify
```

## Publishing

Before making a public GitHub repository, check:

```sh
git status --short
git grep -n "xoxb-\\|xapp-\\|sk-" -- .
```

Only `.env.example` should contain placeholder token prefixes.
