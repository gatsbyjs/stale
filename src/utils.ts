import * as Octokit from "@octokit/rest"
import * as github from "@actions/github"
import { Event } from "./types"

type Issue = Octokit.IssuesListForRepoResponseItem
type IssueLabel = Octokit.IssuesListForRepoResponseItemLabelsItem

function isLabeled(issue: Issue, label: string): boolean {
  const labelComparer: (l: IssueLabel) => boolean = l =>
    label.localeCompare(l.name, undefined, { sensitivity: "accent" }) === 0
  return issue.labels.filter(labelComparer).length > 0
}

function appliedLabelBefore(
  dateOfLabelApplication: string,
  num_days: number
): boolean {
  return (
    +new Date() - +new Date(dateOfLabelApplication) / (1000 * 3600 * 24) >=
    num_days
  )
}

function wasLastUpdatedBefore(issue: Issue, num_days: number): boolean {
  // .getTme() returns the time in milliseconds and is bigger the more time that passed
  const daysInMillis = 1000 * 60 * 60 * 24 * num_days
  const millisSinceLastUpdated =
    new Date().getTime() - new Date(issue.updated_at).getTime()

  return millisSinceLastUpdated >= daysInMillis
}

// Since GitHub doesn't allow arrays in workflow files
// You need to use YAML and | pipe
// Therefore this function splits on new lines and creates an array
function parseLabels(files: string): string[] {
  return files.split(/\r?\n/).reduce<string[]>(
    (acc, line) =>
      acc
        .concat(line.split(","))
        .filter(pat => pat)
        .map(pat => pat.trim()),
    []
  )
}

// GitHub converts booleans to strings ¯\_(ツ)_/¯
function isTrue(input: string): boolean {
  return input === "true"
}

async function getDateOfLastAppliedStaleLabel(
  client: github.GitHub,
  issue: Issue,
  staleLabel: string
): Promise<string> {
  const events: Event[] = await getEvents(client, issue)
  const reversedEvents = events.reverse()

  const staleLabeledEvent = reversedEvents.find(
    event => event.event === "labeled" && event.label!.name === staleLabel
  )

  return staleLabeledEvent!.created_at
}

async function getEvents(
  client: github.GitHub,
  issue: Issue
): Promise<Octokit.IssuesListEventsResponse> {
  // per_page: 100 is the maximum
  const options = client.issues.listEvents.endpoint.merge({
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    per_page: 100,
    issue_number: issue.number,
  })

  return await client.paginate(options)
}

export {
  appliedLabelBefore,
  isLabeled,
  wasLastUpdatedBefore,
  parseLabels,
  isTrue,
  getDateOfLastAppliedStaleLabel,
}
