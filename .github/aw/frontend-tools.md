---
network:
  allowed:
    - node
steps:
  - name: Set up Node
    uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4
    with:
      node-version: "22"
  - name: Set up Bun
    uses: oven-sh/setup-bun@0c5077e51419868618aeaa5fe8019c62421857d6 # v2
    with:
      bun-version: "1.3.2"
tools:
  bash:
    - "cd:*"
    - "bun install --frozen-lockfile --ignore-scripts"
    - "npm test:*"
    - "node --experimental-strip-types:*"
    - "node --version"
    - "git worktree add:*"
    - "git worktree remove:*"
---

## Synthetic test execution

Use Node 22 and `bun install --frozen-lockfile --ignore-scripts`, then the
repository's `npm test -- <focused paths>` Vitest command (not Bun's native test
runner). Execute repository code only inside the agent sandbox. Do not use
host steps to execute PR scripts. Do not change dependencies or enable install
scripts to work around an installation failure.

Temporary synthetic tests/worktrees may be created only for the assigned task.
Remove them afterwards, without deleting or reverting any pre-existing files.
Do not expose a server, invoke native devices, contact AWS/Cognito/Lovable, or
collect user data. Native-only tests require Xcode and cannot be claimed to have
run on the Linux agent runner.
