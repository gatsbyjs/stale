import * as Octokit from "@octokit/rest"
import * as github from "@actions/github"

type Issue = Octokit.IssuesListForRepoResponseItem
type IssueLabel = Octokit.IssuesListForRepoResponseItemLabelsItem

function subtractDays(days: number, date: Date = new Date()): string {
  return new Date(+date - 1000 * 60 * 60 * 24 * days).toISOString()
}

function isLabeled(issue: Issue, label: string): boolean {
  const labelComparer: (l: IssueLabel) => boolean = l =>
    label.localeCompare(l.name, undefined, { sensitivity: "accent" }) === 0
  return issue.labels.filter(labelComparer).length > 0
}

function wasLastUpdatedBefore(issue: Issue, num_days: number): boolean {
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

async function getDateOfLastAppliedStaleLabel(client: github.GitHub, issue:Issue, staleLabel) {
  const events = await getEvents(client, issue)
  const reversedEvents = events.reverse()

  // @ts-ignore
  const staleLabeledEvent = reversedEvents.find(event => event.event === 'labeled' && event.label.name === staleLabel)
  // @ts-ignore
  return staleLabeledEvent.created_at
}

async function getEvents(
  client: github.GitHub,
  issue: Issue,
): Promise<[]> {
  let page = 1
  let results = []
  let hasNextPage  = true

  while(hasNextPage) {

    const res = await client.issues.listEvents({
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      per_page: 100,
      issue_number: issue.number,
      page,
    })

    // @ts-ignore
    results = results.concat(res.data)
    hasNextPage = !!(res.headers.link && res.headers.link.includes(`rel="next"`))
    page++
  }

  // @ts-ignore
  return results
}

export { subtractDays, isLabeled, wasLastUpdatedBefore, parseLabels, isTrue, getDateOfLastAppliedStaleLabel }
