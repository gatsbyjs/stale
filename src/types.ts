import * as Octokit from "@octokit/rest"

type QueueType = {
  url: string
  title: string
}

type ReportType = {
  type: string
  text?: {
    type: string
    text: string
  }
}

interface Event extends Octokit.IssuesListEventsResponseItem {
  label?: {
    name: string
    color: string
  }
}

export { QueueType, ReportType, Event }
