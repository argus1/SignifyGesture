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
  pull_request:
    types: [opened, synchronize, reopened, ready_for_review]
    paths:
      - "src/components/signify/**"
      - "src/routes/**"
      - "src/styles.css"
      - "src/lib/signify-store.tsx"
      - "src/lib/nativeBridge.ts"
      - "src/lib/speechStatus.ts"
      - "src/types/nativeBridge.ts"
      - "src/test/**"
      - "Docs/ACCESSIBLE_CONVERSATION_FLOW.md"
  roles: [admin, maintain, write]
if: vars.AGENTIC_WORKFLOWS_ENABLED == 'true' && github.event.pull_request.draft == false
imports:
  - .github/aw/common.md
  - .github/aw/frontend-tools.md
checkout:
  fetch-depth: 0
tools:
  edit:
concurrency:
  group: agent-accessibility-${{ github.event.pull_request.number }}
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

# Test accessible conversation transitions

Inspect PR #${{ github.event.pull_request.number }}, head
`${{ github.event.pull_request.head.sha }}` versus
`${{ github.event.pull_request.base.sha }}` and
Docs/ACCESSIBLE_CONVERSATION_FLOW.md. Use synthetic native bridge events only.

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
