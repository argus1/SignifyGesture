---
name: Agent - accessible conversation tester
description: Test synthetic conversation recovery and speech/camera state transitions.
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
  workflow_dispatch:
    inputs:
      pr_number:
        description: "Open same-repository PR number to test"
        required: true
        type: string
  roles: [admin, maintain, write]
if: vars.AGENTIC_WORKFLOWS_ENABLED == 'true' && github.ref == format('refs/heads/{0}', github.event.repository.default_branch)
imports:
  - .github/aw/common.md
  - .github/aw/frontend-tools.md
  - .github/aw/manual-pr.md
tools:
  edit:
concurrency:
  group: agent-accessibility-${{ inputs.pr_number }}
  cancel-in-progress: true
  job-discriminator: ${{ github.run_id }}
safe-outputs:
  report-incomplete: false
  report-missing-data: false
  report-missing-tool: false
  add-comment:
    max: 1
    target: "${{ inputs.pr_number }}"
    replace-older-comments: true
---

# Test accessible conversation transitions

Inspect the manually selected PR at the shared head/base SHAs and
Docs/ACCESSIBLE_CONVERSATION_FLOW.md. Use synthetic native bridge events only.
Create the selected-head sandbox worktree before installing or running tests.

Install frozen dependencies, then run:
`npm test -- src/test/speech-flow.test.tsx src/test/recognition-status.test.tsx src/test/camera-lifecycle.test.tsx src/test/app-routing.test.tsx src/test/repair-agent.test.ts src/test/native-bridge.test.ts`.

For behavior affected by the diff, add temporary focused Testing Library/Vitest
tests if existing tests cannot demonstrate the scenario. Exercise denied,
restricted, unavailable, error and paused caption states; typed/quick-reply
fallback; partial-to-final captions; explicit Speak and Stop; mic pause during
TTS; low-confidence Confirm/Edit/Type; camera shutdown on navigation/mode switch;
and native viewport transparency. Do not fix production code or persist tests.
Remove only your temporary tests at the end.

Publish at most one replaceable comment, "Accessible conversation regression
check", containing head SHA, scenario/status/evidence, exact commands, newly
introduced failures with file/line evidence, and suggested missing tests.
Call out existing baseline failures separately. State explicitly that DOM tests
do not verify VoiceOver, hardware permissions, real audio/video, or native layers.
If no new failure or actionable coverage gap exists, call noop with the tested
scenarios and limitations. Do not claim a pass when execution was blocked.
