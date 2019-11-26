import { QueueType, ReportType } from "./types"

/*
Logic of this function is largely borrowed from:
https://github.com/gatsbyjs/gatsby/blob/529dc1c6d345e048051757b27ced6a8e5e554ed8/.github/actions/high-priority-prs/src/pr-message.js
 */

/**
 * Format a list of issues to Slack's block kit
 * @see https://api.slack.com/tools/block-kit-builder
 * @param queue
 */
const slackMessage = (queue: QueueType[]): ReportType[] => {
  const report: ReportType[] = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          "Hi, this is your friendly Stale Action BOT with the latest closed issues",
      },
    },
  ]

  report.push({
    type: "divider",
  })

  report.push({
    type: "section",
    text: {
      type: "mrkdwn",
      text: `[${queue.length}] *_Issues were closed_*`,
    },
  })

  let text = ``

  queue.map((issue, i) => {
    text += `${i + 1 + `. `}<${issue.url}|${issue.title}>\n`
  })

  if (text === ``) {
    text = "There are none! Great job!"
  }

  report.push({
    type: "section",
    text: {
      type: "mrkdwn",
      text,
    },
  })

  return report
}

export default slackMessage
