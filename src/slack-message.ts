import { QueueType, ReportType } from "./types"

const slackMessage = (queue: QueueType[]) => {
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
