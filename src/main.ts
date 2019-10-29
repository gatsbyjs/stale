import * as core from "@actions/core"
import * as github from "@actions/github"
import * as Octokit from "@octokit/rest"
import { WebClient } from "@slack/web-api"

import {
  subtractDays,
  wasLastUpdatedBefore,
  isLabeled,
  parseLabels,
  isTrue,
} from "./utils"
import slackMessage from "./slack-message"
import { QueueType } from "./types"

type Issue = Octokit.IssuesListForRepoResponseItem

type Args = {
  GITHUB_TOKEN: string
  DRY_RUN: boolean
  STALE_ISSUE_MESSAGE: string
  CLOSE_MESSAGE: string
  STALE_PR_MESSAGE: string
  DAYS_BEFORE_STALE: number
  DAYS_BEFORE_CLOSE: number
  STALE_ISSUE_LABEL: string
  EXEMPT_ISSUE_LABELS: string[]
  STALE_PR_LABEL: string
  EXEMPT_PR_LABELS: string[]
  OPERATIONS_PER_RUN: number
  SLACK_STALE_CHANNEL_ID: string
  SLACK_TOKEN: string
}

let queue: QueueType[] = []

async function run() {
  try {
    const args = getAndValidateArgs()

    if (args.DRY_RUN) {
      core.debug(`----- Running in DRY mode -----`)
    }

    const client = new github.GitHub(args.GITHUB_TOKEN)
    await processIssues(client, args, args.OPERATIONS_PER_RUN)

    if (args.SLACK_STALE_CHANNEL_ID) {
      const report = slackMessage(queue)

      if (!args.DRY_RUN) {
        const slack = new WebClient(args.SLACK_TOKEN)

        const res = await slack.chat.postMessage({
          text: ``,
          channel: args.SLACK_STALE_CHANNEL_ID,
          blocks: report,
        })

        if (!res.ok) {
          throw new Error(res.error)
        }
      } else {
        core.debug(`Message to Slack:`)
        core.debug(JSON.stringify(report, null, 2))
      }
    } else {
      core.debug(`You have no SLACK_STALE_CHANNEL_ID defined`)
    }
  } catch (error) {
    core.error(error)
    core.setFailed(error.message)
  }
}

async function processIssues(
  client: github.GitHub,
  args: Args,
  operationsLeft: number,
  page: number = 1
): Promise<number> {
  const issues = await client.issues.listForRepo({
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    state: "open",
    per_page: 100,
    page: page,
  })

  operationsLeft -= 1

  if (issues.data.length === 0 || operationsLeft === 0) {
    return operationsLeft
  }

  for (const issue of issues.data.values()) {
    core.debug(
      `found issue: "${issue.title}" (#${issue.number}) ― last updated: ${issue.updated_at}`
    )
    let isPr = !!issue.pull_request

    // If no stale message for issue/PR is defined, skip it
    let staleMessage = isPr ? args.STALE_PR_MESSAGE : args.STALE_ISSUE_MESSAGE
    if (!staleMessage) {
      core.debug(
        `skipping ${
          isPr ? "pr" : "issue"
        } due to empty stale message in the action's config`
      )
      continue
    }

    // If the issue has at least one assignee, skip it
    if (issue.assignee !== null && issue.assignees.length >= 1) {
      core.debug(
        `skipping ${
          isPr ? "pr" : "issue"
        } because at least one person is assigned`
      )
      continue
    }

    let staleLabel = isPr ? args.STALE_PR_LABEL : args.STALE_ISSUE_LABEL
    let exemptLabels = isPr ? args.EXEMPT_PR_LABELS : args.EXEMPT_ISSUE_LABELS

    // Check if at least one exempt label is present
    if (exemptLabels.some(exemptLabel => isLabeled(issue, exemptLabel))) {
      continue
    } else if (isLabeled(issue, staleLabel)) {
      // Check if the staleLabel is present & the last update is longer than the close days. If yes, close the issue
      if (wasLastUpdatedBefore(issue, args.DAYS_BEFORE_CLOSE)) {
        operationsLeft -= await closeIssue(
          client,
          issue,
          args.CLOSE_MESSAGE,
          args.DRY_RUN
        )
        // If a user commented since the addition of the stale label, remove the label
      } else if (
        await issueHasActivity(client, issue, args.DAYS_BEFORE_STALE)
      ) {
        operationsLeft -= 1
        operationsLeft -= await removeStaleLabel(
          client,
          issue,
          staleLabel,
          args.DRY_RUN
        )
      } else {
        operationsLeft -= 1
        continue
      }
    } else if (wasLastUpdatedBefore(issue, args.DAYS_BEFORE_STALE)) {
      // Check if the last update on the issue is longer than the stale days. If yes, mark the issue stale
      operationsLeft -= await addStaleLabel(
        client,
        issue,
        staleMessage,
        staleLabel,
        args.DRY_RUN
      )
    }

    if (operationsLeft <= 0) {
      core.warning(
        `performed ${args.OPERATIONS_PER_RUN} operations, exiting to avoid rate limit`
      )
      return 0
    }
  }
  return await processIssues(client, args, operationsLeft, page + 1)
}

/**
 * issueHasActivity - Check the issue's comments
 * @description List all comments, filter out comments from Bots. If the array is empty, no user activity is given during the time duration
 * @param client
 * @param issue
 * @param daysBeforeStale
 * @return When user comments can be found, return true. For an empty array, false.
 */
async function issueHasActivity(
  client: github.GitHub,
  issue: Issue,
  daysBeforeStale: number
): Promise<boolean> {
  const comments = await client.issues.listComments({
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    issue_number: issue.number,
    since: subtractDays(daysBeforeStale),
  })

  const filtered = comments.data.filter(comment => comment.user.type === "User")

  return filtered.length > 0
}

async function addStaleLabel(
  client: github.GitHub,
  issue: Issue,
  staleMessage: string,
  staleLabel: string,
  dryRun: boolean
): Promise<number> {
  core.debug(`marking issue "${issue.title}" (#${issue.number}) as stale`)

  if (!dryRun) {
    await client.issues.createComment({
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      issue_number: issue.number,
      body: staleMessage,
    })

    await client.issues.addLabels({
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      issue_number: issue.number,
      labels: [staleLabel],
    })

    return 2
  } else {
    return 0
  }
}

async function removeStaleLabel(
  client: github.GitHub,
  issue: Issue,
  staleLabel: string,
  dryRun: boolean
): Promise<number> {
  core.debug(
    `removing stale label on issue "${issue.title}" (#${issue.number})`
  )

  if (!dryRun) {
    await client.issues.removeLabel({
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      issue_number: issue.number,
      name: encodeURIComponent(staleLabel), // A label can have a "?" in the name
    })

    return 1
  } else {
    return 0
  }
}

async function closeIssue(
  client: github.GitHub,
  issue: Issue,
  closeMessage: string,
  dryRun: boolean
): Promise<number> {
  core.debug(
    `closing issue "${issue.title}" (#${issue.number}) for being stale`
  )

  queue.push({
    url: issue.html_url,
    title: issue.title,
  })

  if (!dryRun) {
    await client.issues.createComment({
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      issue_number: issue.number,
      body: closeMessage,
    })

    await client.issues.update({
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      issue_number: issue.number,
      state: "closed",
    })

    return 2
  } else {
    return 0
  }
}

function getAndValidateArgs(): Args {
  const args = {
    GITHUB_TOKEN: core.getInput("GITHUB_TOKEN", { required: true }),
    DRY_RUN: isTrue(core.getInput("DRY_RUN")),
    STALE_ISSUE_MESSAGE: core.getInput("STALE_ISSUE_MESSAGE"),
    CLOSE_MESSAGE: core.getInput("CLOSE_MESSAGE"),
    STALE_PR_MESSAGE: core.getInput("STALE_PR_MESSAGE"),
    DAYS_BEFORE_STALE: parseInt(
      core.getInput("DAYS_BEFORE_STALE", { required: true })
    ),
    DAYS_BEFORE_CLOSE: parseInt(
      core.getInput("DAYS_BEFORE_CLOSE", { required: true })
    ),
    STALE_ISSUE_LABEL: core.getInput("STALE_ISSUE_LABEL", { required: true }),
    EXEMPT_ISSUE_LABELS: parseLabels(core.getInput("EXEMPT_ISSUE_LABELS")),
    STALE_PR_LABEL: core.getInput("STALE_PR_LABEL", { required: true }),
    EXEMPT_PR_LABELS: parseLabels(core.getInput("EXEMPT_PR_LABELS")),
    OPERATIONS_PER_RUN: parseInt(
      core.getInput("OPERATIONS_PER_RUN", { required: true })
    ),
    SLACK_STALE_CHANNEL_ID: core.getInput("SLACK_STALE_CHANNEL_ID"),
    SLACK_TOKEN: core.getInput("SLACK_TOKEN"),
  }

  for (const numberInput of [
    "DAYS_BEFORE_STALE",
    "DAYS_BEFORE_CLOSE",
    "OPERATIONS_PER_RUN",
  ]) {
    if (isNaN(parseInt(core.getInput(numberInput)))) {
      throw Error(`input ${numberInput} did not parse to a valid integer`)
    }
  }

  return args
}

run()
