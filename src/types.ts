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

export { QueueType, ReportType }
