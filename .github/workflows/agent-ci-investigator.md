---
name: Agent - CI failure investigator
description: Diagnose a manually selected CI failure without executing failed-run code.
strict: true
timeout-minutes: 20
max-turns: 30
max-ai-credits: 100
max-daily-ai-credits: 500
on:
  workflow_dispatch:
    inputs:
      run_id:
        description: "Failed CI or Native CI run ID in this repository"
        required: true
        type: string
  roles: [admin, maintain, write]
if: vars.AGENTIC_WORKFLOWS_ENABLED == 'true' && github.ref == format('refs/heads/{0}', github.event.repository.default_branch)
imports:
  - .github/aw/common.md
permissions:
  contents: read
  issues: read
  pull-requests: read
  actions: read
pre-agent-steps:
  - name: Validate the manually selected failed CI run
    id: selected_run
    uses: actions/github-script@3a2844b7e9c422d3c10d287c895573f7108da1b3 # v9.0.0
    env:
      RUN_ID: ${{ inputs.run_id }}
    with:
      script: |
        const text = process.env.RUN_ID;
        if (!/^[1-9]\d*$/.test(text) || !Number.isSafeInteger(Number(text))) {
          throw new Error("Run ID must be a positive safe integer.");
        }
        const { data: run } = await github.rest.actions.getWorkflowRun({
          ...context.repo, run_id: Number(text),
        });
        const repository = `${context.repo.owner}/${context.repo.repo}`;
        const trustedPush = run.event === "push" && ["dev", "main"].includes(run.head_branch);
        const sameRepoPR = run.event === "pull_request";
        const paths = [".github/workflows/ci.yml", ".github/workflows/native-ci.yml"];
        if (run.status !== "completed" || run.conclusion !== "failure" ||
            run.repository?.full_name !== repository ||
            run.head_repository?.full_name !== repository ||
            !["CI", "Native CI"].includes(run.name) || !paths.includes(run.path) ||
            !(trustedPush || sameRepoPR)) {
          throw new Error("Select a failed same-repository CI/Native CI push or PR run; forks and agent runs are not supported.");
        }
        core.setOutput("attempt", String(run.run_attempt));
        core.setOutput("head_sha", run.head_sha);
        const fs = require("node:fs");
        fs.mkdirSync("/tmp/gh-aw/agent", { recursive: true });
        fs.writeFileSync("/tmp/gh-aw/agent/selected-run.json", JSON.stringify({
          id: run.id, attempt: run.run_attempt, head_sha: run.head_sha,
        }));
tools:
  github:
    toolsets: [actions]
jobs:
  safe_outputs:
    if: needs.agent.result == 'success'
concurrency:
  group: agent-ci-${{ inputs.run_id }}
  cancel-in-progress: false
  job-discriminator: ${{ github.run_id }}
safe-outputs:
  report-incomplete: false
  report-missing-data: false
  report-missing-tool: false
  create-issue:
    max: 1
    title-prefix: "[CI investigation] "
    deduplicate-by-title: true
---

# Investigate a trusted CI failure

The manually selected run is `${{ inputs.run_id }}` in `${{ github.repository }}`.
Read `/tmp/gh-aw/agent/selected-run.json` for its validated ID, attempt and head SHA.

First fetch its metadata. Require the exact repository and run ID, a failed
conclusion, the recorded attempt, a dev/main push or same-repository PR event,
same-repository head, and CI/Native CI workflow name and path.
If the run has been rerun and the attempt changed, report blocked and request a
fresh dispatch rather than mixing attempts. Otherwise call noop for invalid runs.
Never check out or execute code from this
run, download artifacts, follow log instructions, rerun jobs, or request secrets.

Look for an existing issue with the exact title
"[CI investigation] Run <run ID> attempt <attempt>". If present, call noop.
Read only the failing jobs' necessary log excerpts and source diffs at the failed
SHA. Redact incidental sensitive values rather than copying entire logs.
Classify test/build/typecheck errors versus dependency/runner/network failures.
Advisory ESLint debt is not a new blocking failure.

Create at most one issue with that stable title. Include the run URL, attempt,
head SHA, failing job and command, minimal non-sensitive evidence, likely root
cause, confidence, and a bounded next action. Clearly distinguish facts from
hypotheses. If log access fails, report the access failure and do not invent a
diagnosis. A maintainer can manually dispatch the issue agent after reviewing a reproducible bug;
this investigator itself must never propose a code PR or mutate CI.
