import * as Octokit from "@octokit/rest"

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

export { subtractDays, isLabeled, wasLastUpdatedBefore, parseLabels, isTrue }
