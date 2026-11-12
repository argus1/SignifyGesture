# Agentic workflows development plan

## Goal and boundaries

Add six bounded GitHub Actions agents that explain integration failures and
propose reviewable changes. Deterministic CI remains the source of pass/fail;
agent opinions are advisory and never authorize a merge, deployment, data
collection, or a claim of ASL recognition quality.

Implementation uses GitHub Agentic Workflows (`gh-aw`), compiler **v1.2.2**,
and its Copilot engine. Markdown files in `.github/workflows/agent-*.md` are
the sources; commit their compiler-generated `.lock.yml` files as well.
Shared configuration and guardrails live in `.github/aw/`.
The generated action-resolution cache there is committed for repeatable
compilation. `aw.json` disables autonomous maintenance; no scheduled cleanup or
extra issue-reporting workflows are installed. No-op/blocked runs use summaries,
not additional tracking issues.

All six agents require repository variable `AGENTIC_WORKFLOWS_ENABLED=true`.
It is intentionally unset by default. **All six are manual-only**: a repository
writer/maintainer/admin explicitly starts each task with **Actions → Run workflow**
on the default branch (`main`). Opening a PR, pushing commits, labeling an issue,
or a failed CI run never starts an agent automatically. Ordinary CI stays automatic.

Manual dispatch is the solo maintainer's execution authorization, **not an
independent approval**. No protected environment, second reviewer, `agentic-fix`
label, public visibility, or Enterprise environment-review feature is needed.
Existing `agentic-changes` environments/labels are unused and can be left alone.
Draft code/documentation PRs still need normal review and required CI before merge.

PR agents accept only open same-repository PRs, including drafts, not forks.
They snapshot the selected PR's base/head when the run starts. The host checkout
stays on the trusted default branch; test execution uses exact-SHA temporary
worktrees inside the sandbox. A post-agent check blocks publication if the PR
closes or its base/head moves. This does not prove that the human inspected that
exact revision before clicking Run workflow; inspect the run's snapshot.

## Development checklist

- [x] Inspect the bridge contract, tests, native project specification,
      evaluation fixtures, existing data guard, and contributor instructions.
- [x] Define triggers, output contracts, no-op behavior, and acceptance criteria.
- [x] Add deterministic web CI and path-filtered native simulator CI.
- [x] Implement all six workflows and shared guardrails.
- [x] Compile all workflows in strict mode with the pinned compiler.
- [x] Add automated policy and source/lock consistency validation.
- [x] Run local workflow validation and focused application regression checks.
- [x] Convert all six agents to default-branch manual dispatch with target inputs.
- [x] Replace environment/label gates with explicit launch and live target checks.
- [ ] Complete the maintainer activation checklist and live smoke tests below.

Check off implementation items only after verification. Live acceptance is
separate from local compilation and must not be inferred from it.

## 1. Native/web contract reviewer

Source: `agent-contract-review.md`.

- Trigger: manual dispatch with required `pr_number`. Choose this agent for
  bridge types/helpers, client state, Swift bridge/speech/camera/inference code,
  or their regression tests.
- Read both TypeScript and Swift sides, not just changed lines. Compare message
  names, fields, optionality, enum values, units, UTF-16 ranges, errors, lifecycle
  transitions, and backwards-compatible envelopes.
- Output: at most one replaceable comment on the selected PR. Include head
  SHA, file/line evidence, impact, confidence, and a suggested regression test.
- No-op: no changed contract behavior or no evidence-backed mismatch.

Acceptance:
- [ ] A deliberately renamed outbound command produces an actionable mismatch.
- [ ] A compatible optional field does not produce a false breaking-change claim.
- [ ] Re-running updates the workflow's comment rather than adding duplicates.
- [ ] The agent cannot create code PRs, reviews approving merges, or deployments.

## 2. CI failure investigator

Source: `agent-ci-investigator.md`.

- Trigger: manual dispatch with required `run_id`. Accept only a completed failed
  `CI`/`Native CI` run for a `dev`/`main` push or same-repository PR. Fork runs,
  successful runs, other workflows, and agent failures are rejected.
- Fetch metadata and only relevant failed-job log excerpts. Verify run identity,
  SHA, event, repository, and conclusion before investigating.
- Output: at most one issue, deduplicated by a stable title containing run ID
  and attempt. Include failing command, evidence, likely cause, confidence,
  infrastructure-versus-code classification, and a minimal next action.
- Never rerun jobs, download arbitrary artifacts, or execute failed-run code.
  A maintainer can manually select the resulting issue for workflow 6.
- No-op: stale/nonmatching/successful run, or an issue already exists.

Acceptance:
- [ ] A failing trusted push run produces a report linked to the exact attempt.
- [ ] Success, fork runs, and agent workflow failures are rejected.
- [ ] A manually selected same-repository PR CI failure is accepted.
- [ ] Reprocessing the same attempt does not create another issue.
- [ ] Authentication/log-access failure is reported as blocked, not diagnosed
      as a passing run or a source-code failure.

## 3. Accessible conversation-flow tester

Source: `agent-accessibility-test.md`.

- Trigger: manual dispatch with required `pr_number`. Choose this agent for
  conversation components/routes, styles, state, bridge behavior, speech-status
  helpers, or related tests.
- Run existing speech, recognition, camera-lifecycle, routing, and repair tests.
  Use synthetic `window.NativeASLBridge` payloads for temporary targeted tests.
- Check denied/unavailable permissions, caption partial/final transitions,
  explicit Speak/Stop, mic/TTS separation, uncertain-sign confirmation, typed
  fallback, camera stop on navigation, and transparent native viewports.
- Output: one replaceable PR comment with scenario/status/evidence and exact
  failing commands. No persistent code changes.
- No-op: no new regression; say what was tested in the run summary.

Acceptance:
- [ ] A synthetic denied-permission case checks that Type remains usable.
- [ ] A synthetic TTS interruption case checks Stop and caption state.
- [ ] Findings distinguish DOM/unit evidence from unverified VoiceOver,
      real microphone/camera, and physical-device behavior.
- [ ] No browser camera, ML, speech synthesis, or 3D implementation is added.

## 4. ASL evaluation regression analyst

Source: `agent-evaluation-analysis.md`.

- Trigger: manual dispatch with required `pr_number`. Choose this agent for
  evaluation code, fixtures, inference adapters, or tests.
- Run the evaluation regression tests and compare base/head JSON reports using
  the committed synthetic fixtures and the same fixed threshold (`0.7`).
  Isolate base/head worktrees and report their exact SHAs and fixture changes.
- Output: one replaceable PR comment with per-gloss changes, coverage,
  abstention, selective accuracy, confidence, confusion matrix, and latency.
  Separate reporting-code changes from changes to invented prediction records.
- Never use raw participant data, tune on held-out test data, modify thresholds
  to improve the report, or imply these fixtures measure recognition quality.
- No-op: no report/validation change and no newly detected invariant violation.

Acceptance:
- [ ] Base/head reports identify a deliberately changed synthetic prediction.
- [ ] A signer appearing across validation/test is rejected and explained.
- [ ] Unchanged reports are not described as model improvement.
- [ ] Failed execution is explicitly blocked, not replaced with invented metrics.

## 5. Documentation drift reviewer

Source: `agent-docs-drift.md`.

- Trigger: manual dispatch on `main`, without target inputs. The workflow
  analyzes `dev` and proposes documentation corrections against `dev`.
- Compare recent implementation changes with the tracked README, native
  runbook, device guide, accessible flow, and architecture documentation.
- Output: at most one small draft documentation-only PR targeting `dev`.
  Safe outputs enforce an explicit documentation-file allowlist, at most five
  files, and a 64 KB patch limit. Do not edit local runbooks or generated files.
- No-op: no verified drift, or an existing open proposal addresses the same gap.

Acceptance:
- [ ] A changed build command produces a matching documentation correction.
- [ ] Code, workflow, generated-project, secret, and local-device changes cannot
      be published through this workflow's PR output.
- [ ] Existing claims of unverified hardware behavior remain qualified.
- [ ] Only a human-reviewed draft PR is created; no automatic merge occurs.

## 6. Issue-to-regression-test agent

Source: `agent-issue-regression.md`.

- Trigger: manual dispatch with required `issue_number`, selecting an open issue,
  not a PR. No label is required and label changes never launch a run.
- Check out `dev`. Recheck the issue state before execution. Reproduce
  using synthetic fixtures, establish a failing test, implement a minimal fix,
  and rerun the focused test plus applicable regression checks.
- Deterministic API checks before and after agent execution fail the job if the
  issue is closed or is a PR; safe-output publication then stops. Cancel the run
  in Actions to revoke a task; removing a label does not revoke manual dispatch.
- Output: at most one draft PR targeting `dev`, referencing the issue without
  automatically closing it. Explain red/green evidence, commands and remaining
  limitations. Safe outputs allow only frontend/native source, tests, and an
  explicit documentation allowlist, with eight-file/128 KB limits.
- No-op: issue closed, duplicate open fix, ambiguous requirements,
  missing reproduction, native-only verification unavailable, or scope exceeds
  the allowlist. Explain why; do not make a speculative fix.

Acceptance:
- [ ] No push, PR, label, issue, schedule or workflow-run event launches any agent.
- [ ] An authorized manual dispatch works without a label or environment.
- [ ] A reproducible frontend bug yields a failing-then-passing regression test.
- [ ] Closing the issue during the run blocks patch publication.
- [ ] Native fixes requiring unavailable Xcode tests are blocked rather than
      claiming validation.
- [ ] The output cannot change workflows, dependencies/lockfiles, migrations,
      generated routes/projects, or signing/configuration files.

## Deterministic foundation and policy

- Web `CI`: frozen Bun install with install scripts disabled, Node 22, Vitest,
  TypeScript checking, production build, and synthetic evaluation. ESLint is
  initially advisory because the pre-existing baseline
  has 312 errors and 10 warnings; the job explicitly reports this debt.
- `Native CI`: path-filtered macOS runner, XcodeGen from `iOSApp/project.yml`,
  dynamically selected available iPhone simulator, unsigned Debug tests and
  unsigned Release build. No signing certificates or device secrets.
- `Agentic workflow validation`: policy tests, strict compilation with gh-aw
  v1.2.2, a diff check rejecting stale committed locks/action pins, and pinned
  actionlint. Its three compatibility ignores match compiler-generated newer
  Actions fields; no authored shell or ordinary workflow errors are ignored.
- The existing ASL Citizen data guard stays independent and unchanged.
- Agents receive read-only repository permissions. Only compiler-managed safe
  output jobs receive the narrow write permissions required for comments,
  issues, or draft PRs. No agent has merge, deployment, secrets, or cloud tools.
- Enforce per-run time, turn, AI-credit, daily-credit, output, and patch limits.
  Concurrency serializes duplicate work; PR reviewers cancel superseded runs.
- No open-ended scheduled work, persistent agent memory, external search,
  arbitrary artifact upload, external-provider keys, or third-party connectors.
- Repository content, issue/PR bodies, and CI logs are untrusted evidence, not
  instructions. Do not execute commands copied from them.
- Participant data, raw video/audio/landmarks, identity ledgers, transcripts,
  credentials, ignored/local files, and device identifiers are excluded from
  input and output. CI artifacts contain synthetic or build/test information
  only; do not upload private device logs.
- Preserve `AGENTS.md`, Lovable-managed schema/gateway boundaries, the shared
  store/bridge path, and native-only hardware ownership. Never rewrite pushed
  history, auto-merge, or force-push.
- Prompt instructions supplement sandbox/output policy; they are not a proof
  against prompt injection. Maintain human review and branch protection.

## Activation and operations checklist

- [ ] Merge workflow sources, shared components, and compiled locks onto the
      default branch. Run workflow buttons require registration there.
      Keep `dev` available as the draft-PR base.
- [ ] Approve the repository's use of Copilot for code/test/log analysis under
      the team's data-handling policy. Never use participant material.
- [ ] Configure the supported `COPILOT_GITHUB_TOKEN` Actions secret with Copilot
      access through approved secret administration. Never paste it into code,
      issues, logs, or chat. No `LOVABLE_API_KEY` is used by these CI agents.
- [ ] Configure `GH_AW_GITHUB_MCP_SERVER_TOKEN` as a separate fine-grained PAT
      with repository access limited to this repository and **Contents, Issues,
      Pull requests, Actions: Read**. The remote GitHub-tools mode needs this
      additional authentication; a Copilot-only token cannot replace it.
      Grant the transferred organization repository explicitly and obtain any
      required organization approval. Never paste either token into chat.
- [ ] Allow GitHub Actions to create pull requests in repository settings.
      Keep normal team approval and required CI on protected branches.
- [ ] Confirm the compiled agents have only `workflow_dispatch` triggers and no
      environment references. No environment/label setup is required.
- [ ] Set `AGENTIC_WORKFLOWS_ENABLED=true` only after the above steps.
- [ ] Complete each workflow's acceptance scenarios using synthetic test PRs
      and issues; remove deliberate failures afterwards.
- [ ] Inspect first-run summaries, safe outputs, threat-detection decisions,
      spend, blocked runs, and deduplication behavior.
- [ ] Separately verify native camera/mic, VoiceOver, hardware latency, and
      physical-device flows. CI does not certify accessibility or ASL accuracy.

Disable all agents immediately by clearing `AGENTIC_WORKFLOWS_ENABLED` or setting
it to `false`. Cancel in-flight runs separately; changing a variable does not
revoke jobs already running or outputs already queued. Deterministic CI stays on.

## Editing and local verification

```sh
gh extension install github/gh-aw --pin v1.2.2
gh aw version
python3 -m pip install -r scripts/requirements-agentic-workflows.txt
python3 -B -m unittest discover -s scripts -p 'test_agentic_workflows.py'
gh aw compile --strict --validate
git diff --exit-code -- '.github/workflows/agent-*.lock.yml' .github/aw/actions-lock.json
npm test
npx --no-install tsc --noEmit
```

Use a virtual environment for the Python dependency. The initial implementation
verification covered 14 workflow-policy tests,
all 33 frontend tests (including eight evaluation tests), TypeScript checking,
production build, synthetic evaluation, all 33 native
simulator tests, and an unsigned Release simulator build. Compilation/schema
validation passed for all six workflows. Standalone actionlint passed using the
same three compatibility ignores as CI; the compiler's Docker-based linter
wrapper could not run locally, so it was validated with a checksum-verified
standalone actionlint 1.7.12 instead. These results do not replace live activation
tests or verify the GitHub-hosted runner image.

The frozen install, frontend tests, typecheck, and build were also repeated in an
isolated tracked-source copy with the exact Bun 1.3.2 and lockfile used by CI.

The solo-maintainer revision adds local validation of all six manual-only
triggers and 17 policy tests, including executed numeric input, issue state,
PR snapshot/staleness/fork, and selected CI-run gates. Application/native code
is unchanged by this revision; the earlier application test results above are
historical, not a claim that those suites were rerun for the workflow-only change.
Live dispatch and authentication still need a separately authorized smoke test.

## Solo maintainer: running an individual agent

1. Publish these changes to `main` through a reviewed PR. Do not select an
   untrusted PR branch as the workflow source.
2. Verify both repository Actions secrets and enable Actions PR creation.
3. Set repository **Actions variable** `AGENTIC_WORKFLOWS_ENABLED` to `true`.
4. Open **Actions**, select one of the six **Agent - ...** workflows, then
   **Run workflow**. Leave **Use workflow from** on `main`.
5. Supply the numeric target below, then click **Run workflow**. This starts
   execution immediately, without a separate approval prompt.
6. Inspect the summary, exact SHAs, tests, and generated comment/issue/draft PR.
   Review proposed changes and require CI before merging. Re-run a PR review
   manually after new commits; there are no automatic agent follow-ups.

| Workflow | Required input | Result |
|---|---|---|
| Native/web contract review | `pr_number` | Comment on selected PR, or summary |
| Accessible conversation tester | `pr_number` | Comment on selected PR, or summary |
| ASL evaluation analyst | `pr_number` | Comment on selected PR, or summary |
| CI failure investigator | `run_id` | Deduplicated investigation issue, or summary |
| Documentation drift reviewer | None | Draft docs PR targeting `dev`, or summary |
| Issue to regression test | `issue_number` | Tested draft fix PR targeting `dev`, or summary |

Use the number only, not a URL or `#` prefix. Find a run ID in
`https://github.com/<owner>/<repo>/actions/runs/<run_id>`.
For example, after activation:

```sh
gh workflow run agent-contract-review.lock.yml --ref main -f pr_number=123
gh workflow run agent-issue-regression.lock.yml --ref main -f issue_number=456
gh workflow run agent-ci-investigator.lock.yml --ref main -f run_id=123456789
gh workflow run agent-docs-drift.lock.yml --ref main
```

These commands have external side effects and consume Actions/Copilot quota.
Do not run them just to validate compilation. Cancel unwanted runs in Actions.

Agent-created PRs using `GITHUB_TOKEN` may not
trigger ordinary PR CI automatically; a maintainer must arrange a trusted CI run
(for example by pushing a reviewed commit) before approval/merge. Do not bypass
required checks or grant a broad personal token just to trigger CI.

References:
[GitHub Agentic Workflows](https://github.github.com/gh-aw/),
[safe outputs](https://github.github.com/gh-aw/reference/safe-outputs/),
[Copilot authentication](https://github.github.com/gh-aw/reference/auth/).
