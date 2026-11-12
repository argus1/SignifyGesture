---
checkout:
  ref: ${{ github.event.repository.default_branch }}
  fetch-depth: 0
  pull-request: false
pre-agent-steps:
  - name: Validate and snapshot the selected PR
    id: selected_pr
    uses: actions/github-script@3a2844b7e9c422d3c10d287c895573f7108da1b3 # v9.0.0
    env:
      PR_NUMBER: ${{ inputs.pr_number }}
    with:
      script: |
        const text = process.env.PR_NUMBER;
        if (!/^[1-9]\d*$/.test(text) || !Number.isSafeInteger(Number(text))) {
          throw new Error("PR number must be a positive safe integer.");
        }
        const { data: pr } = await github.rest.pulls.get({
          ...context.repo, pull_number: Number(text),
        });
        const repository = `${context.repo.owner}/${context.repo.repo}`;
        if (pr.state !== "open" || pr.head.repo?.full_name !== repository ||
            pr.base.repo?.full_name !== repository ||
            !/^[a-f0-9]{40}$/.test(pr.head.sha) || !/^[a-f0-9]{40}$/.test(pr.base.sha)) {
          throw new Error("Select an open same-repository PR with valid head/base revisions; forks are not supported.");
        }
        core.setOutput("number", String(pr.number));
        core.setOutput("head_sha", pr.head.sha);
        core.setOutput("base_sha", pr.base.sha);
        const fs = require("node:fs");
        fs.mkdirSync("/tmp/gh-aw/agent", { recursive: true });
        fs.writeFileSync("/tmp/gh-aw/agent/selected-pr.json", JSON.stringify({
          number: pr.number, head_sha: pr.head.sha, base_sha: pr.base.sha,
        }));
        await core.summary.addHeading("Manually authorized PR review")
          .addRaw(`PR #${pr.number}\n\nHead: ${pr.head.sha}\n\nBase: ${pr.base.sha}\n`).write();
post-steps:
  - name: Reject stale PR results before publication
    if: success()
    uses: actions/github-script@3a2844b7e9c422d3c10d287c895573f7108da1b3 # v9.0.0
    env:
      PR_NUMBER: ${{ inputs.pr_number }}
      REVIEWED_HEAD: ${{ steps.selected_pr.outputs.head_sha }}
      REVIEWED_BASE: ${{ steps.selected_pr.outputs.base_sha }}
    with:
      script: |
        const { data: pr } = await github.rest.pulls.get({
          ...context.repo, pull_number: Number(process.env.PR_NUMBER),
        });
        const repository = `${context.repo.owner}/${context.repo.repo}`;
        if (pr.state !== "open" || pr.head.repo?.full_name !== repository ||
            pr.base.repo?.full_name !== repository ||
            pr.head.sha !== process.env.REVIEWED_HEAD ||
            pr.base.sha !== process.env.REVIEWED_BASE) {
          throw new Error("PR closed or revisions changed; refusing stale review publication. Dispatch a new review.");
        }
jobs:
  safe_outputs:
    if: needs.agent.result == 'success'
tools:
  bash:
    - "git worktree add:*"
    - "git worktree remove:*"
---

## Selected PR and revision binding

Read `/tmp/gh-aw/agent/selected-pr.json` for the validated PR number, head_sha and
base_sha captured before the agent started. Review only that PR in this repository.
The host checkout stays on the trusted default branch, not the PR branch.
Use `git show <head SHA>:<path>` and `git diff <base SHA> <head SHA>` for
read-only inspection. For test execution, create a temporary detached worktree
at the exact selected head SHA INSIDE the sandbox and run every install/test
command from that directory, never from the default-branch checkout.
If either SHA is unavailable, report blocked rather than substituting a branch.
Remove only your temporary worktrees afterwards.

Publish comments only to the selected PR number. A deterministic post-agent
check rejects results if the PR closes or its base/head changes during the run.
This binds the review to the snapshot at startup, not to the revision visible
when the human clicked Run workflow. Inspect the logged SHAs if the PR moved
while the run was queued. Dispatch never authorizes merges or other PR targets.
