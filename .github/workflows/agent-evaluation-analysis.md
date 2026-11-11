---
name: Agent - ASL evaluation analyst
description: Explain base/head synthetic evaluation deltas without model-quality claims.
strict: true
timeout-minutes: 20
max-turns: 30
max-ai-credits: 100
max-daily-ai-credits: 500
permissions:
  contents: read
  issues: read
  pull-requests: read
on:
  pull_request:
    types: [opened, synchronize, reopened, ready_for_review]
    paths:
      - "scripts/evaluate-asl.ts"
      - "src/lib/aslEvaluation.ts"
      - "src/test/asl-evaluation.test.ts"
      - "fixtures/asl-evaluation/**"
      - "iOSApp/Sources/Inference/**"
  roles: [admin, maintain, write]
if: vars.AGENTIC_WORKFLOWS_ENABLED == 'true' && github.event.pull_request.draft == false
imports:
  - .github/aw/common.md
  - .github/aw/frontend-tools.md
checkout:
  fetch-depth: 0
concurrency:
  group: agent-evaluation-${{ github.event.pull_request.number }}
  cancel-in-progress: true
safe-outputs:
  report-incomplete: false
  report-missing-data: false
  report-missing-tool: false
  add-comment:
    max: 1
    target: triggering
    replace-older-comments: true
---

# Analyze synthetic evaluation regressions

Compare base `${{ github.event.pull_request.base.sha }}` and head
`${{ github.event.pull_request.head.sha }}` of PR
#${{ github.event.pull_request.number }}. These fixtures are invented predictions,
not model results or measurements of people/devices.

Install frozen dependencies and run
`npm test -- src/test/asl-evaluation.test.ts`.
Create separate temporary detached git worktrees at the exact base and head
SHAs. In each worktree run
`node --experimental-strip-types scripts/evaluate-asl.ts fixtures/asl-evaluation/validation.json fixtures/asl-evaluation/test.json 0.7`.
Use no raw capture exports, model downloads, participant samples or network APIs.
If a SHA cannot be resolved, a file does not exist on base, or execution fails,
explicitly report that comparison as blocked; do not substitute another ref.

Compare JSON per-gloss support/precision/recall, confusion matrices, no-result and
unsupported prediction counts, coverage, abstention, selective accuracy,
confidence summaries and latency. Identify changed fixture records separately
from reporting logic or inference adapter changes. Check signer separation,
duplicate trial IDs, unsupported labels, no-result semantics, finite valid
confidence/latency, and coverage requirements.
Keep threshold 0.7 fixed; never search for a better test-set threshold or alter
fixtures to make results pass. Do not conflate the repair-agent default with a
validated model threshold.

Remove your temporary worktrees. If there are meaningful deltas, newly violated
invariants or a blocked comparison, publish one replaceable PR comment titled
"Synthetic ASL evaluation analysis": exact SHAs, fixed threshold, command/test
outcomes, compact before/after metrics, cause, and limitations. Explicitly state
that these are not real recognition quality or device-latency measurements.
Otherwise call noop with the unchanged report and test outcome.
