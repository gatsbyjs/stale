# Close Stale Issues and PRs

Warns and then closes issues and PRs that have had no activity for a specified amount of time.

Based on [`actions/stale`](https://github.com/actions/stale).

Additional features:

- Multiple exempt labels
- Removes the stale label after activity in the marked issue
- Add a message when closing an issue
- DRY run (only logging, no actions)
- Two outputs (`blocks` and `queue`) which can be used for a Slack action or passed to your own action. These outputs list the closed issues after each run

## Usage

### Arguments

| Argument               | Example                           | Required | Description                                                                                               |
|------------------------|-----------------------------------|----------|-----------------------------------------------------------------------------------------------------------|
| GITHUB_TOKEN           | -                                 | Required | Available via environment variables                                                                       |
| DRY_RUN                | true                              | Optional | Default: false. Execute the commands only to the console. No GitHub actions or Slack messages will be run |
| STALE_ISSUE_MESSAGE    | 'Marking this issue as stale'     | Optional | If left empty, no issues will be marked as stale                                                          |
| CLOSE_MESSSAGE         | 'Closing as stale'                | Optional |                                                                                                           |
| STALE_PR_MESSAGE       | 'Marking this PR as stale'        | Optional | If left empty, no PRs will be marked as stale                                                             |
| DAYS_BEFORE_STALE      | 20                                | Required | Days before an issue is marked as stale (e.g. 20 days after inactivity)                                   |
| DAYS_BEFORE_CLOSE      | 10                                | Required | Days before an issue is closed (e.g. 30 days after inactivity, so 10 days after DAYS_BEFORE_STALE)        |
| STALE_ISSUE_LABEL      | 'stale?'                          | Required | Name of the stale label. Must exist already.                                                              |
| EXEMPT_ISSUE_LABELS    | ``` |   not stale   important ``` | Optional | Issues with these labels will stay untouched. Write in YAML syntax (with `|`) to get new line breaks.     |
| STALE_PR_LABEL         | 'stale?'                          | Required | Name of the stale label. Must exist already.                                                              |
| EXEMPT_PR_LABELS       | ``` |   not stale   important ``` | Required | PRs with these labels will stay untouched. Write in YAML syntax (with `|`) to get new line breaks.        |
| OPERATIONS_PER_RUN     | 30                                | Required | The maximum number of operations per run, used to control rate limiting                                   |

### Workflow Examples

The secret `GITHUB_TOKEN` is automatically available, however other secrets need to be set in your "Secrets" tab under "Settings".

#### Basic

```yaml
on:
  schedule:
    - cron: "0 12 * * *"
name: Run Stale Bot on Issue Comments
jobs:
  build:
    name: stale
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@master
      - name: stale
        uses: gatsbyjs/stale@master
        with:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          DAYS_BEFORE_STALE: 20
          DAYS_BEFORE_CLOSE: 10
          STALE_ISSUE_LABEL: 'stale?'
          STALE_PR_LABEL: 'stale?'
          OPERATIONS_PER_RUN: 30
          STALE_ISSUE_MESSAGE: 'marking this as stale message'
          CLOSE_MESSAGE: 'closing message'
          EXEMPT_ISSUE_LABELS: |
            not stale
            important
```

#### Slack

In addition to running the stale bot you can also send a list of closed issues via a bot to a Slack channel. For that the stale action exposes a `blocks` output which has the correct format of [Slack's block kit](https://api.slack.com/tools/block-kit-builder).

We'd recommend the action [Post Slack messages](https://github.com/marketplace/actions/post-slack-message) as it uses a Slack bot token (and not e.g. a webhook).

```yaml
on:
  schedule:
    - cron: "0 12 * * *"
name: Run Stale Bot on Issue Comments
jobs:
  build:
    name: stale
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@master
      - name: stale
        id: stale
        uses: gatsbyjs/stale@master
        with:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          DAYS_BEFORE_STALE: 20
          DAYS_BEFORE_CLOSE: 10
          STALE_ISSUE_MESSAGE: 'marking this as stale'
          CLOSE_MESSAGE: 'closing this issue'
          EXEMPT_ISSUE_LABELS: |
            not stale
            important
      - name: Post slack report
        uses: pullreminders/slack-action@v1.0.7
        env:
          SLACK_BOT_TOKEN: ${{ secrets.SLACK_TOKEN }}
        with:
          args: '{\"channel\": \"${{ secrets.SLACK_STALE_CHANNEL_ID }}\", \"text\": \"\", \"blocks\": ${{ steps.stale.outputs.blocks }} }'
```

It's important that you give the stale action an `id` so that you can reference its output via `steps.<your-id>.outputs.blocks`.

### Notes

In order to be able to see the results during `DRY_RUN` you need to set the secret `ACTIONS_STEP_DEBUG` to `true`. You can read more on [actions/toolkit documention](https://github.com/actions/toolkit/blob/4a3fe0bcd3ac34f58b226a326e6235a6fbf2fee0/docs/action-debugging.md#step-debug-logs).

## Example of Slack bot output

The bot will post a similar message to your channel (the titles are links to the respective issue):

```
Hi, this is your friendly Stale Action BOT with the latest closed issues

[3] Issues were closed

1. test 08
2. Test 07
3. test 03
```
