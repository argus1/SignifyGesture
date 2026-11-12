---
name: Agent - native web contract review
description: Report evidence-backed Swift and TypeScript bridge mismatches.
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
        description: "Open same-repository PR number to review"
        required: true
        type: string
  roles: [admin, maintain, write]
if: vars.AGENTIC_WORKFLOWS_ENABLED == 'true' && github.ref == format('refs/heads/{0}', github.event.repository.default_branch)
imports:
  - .github/aw/common.md
  - .github/aw/manual-pr.md
concurrency:
  group: agent-contract-${{ inputs.pr_number }}
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

# Review native/web contract changes

Review the manually selected PR at the head/base SHAs in the shared instructions.
Use the PR diff and tracked sources at those exact revisions.
Check both src/types/nativeBridge.ts and src/lib/nativeBridge.ts against
iOSApp/Sources/NativeBridge/NativeBridgeCoordinator.swift and native callers,
then verify src/lib/signify-store.tsx consumers and both test suites.

Compare outbound message tags, flat/legacy envelopes, field names, optionality,
enum values, confidence/latency/audio units, timestamp handling, and UTF-16 TTS
progress. Trace camera stop/navigation, speech authorization and listening states,
partial/final caption replacement, explicit TTS start/stop, and mic/TTS separation.
Preserve native viewport transparency and a single simulator/native state path.

Do not edit files or execute source. Report only newly introduced, high-confidence
mismatches, with file/line evidence from both sides, user impact, confidence, and
a concrete synthetic regression test suggestion. Distinguish an intentional
compatible extension from a breaking change. At most one replaceable comment
on this PR, headed "Native/web contract review" with the reviewed head SHA.
If there is no evidence-backed mismatch, call noop and summarize inspected paths.
