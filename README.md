# SignifyGesture
Mobile App for Sign Language Gesture Recognition

![Logo](Logo.jpg)

![Image](1.jpg)

SignifyGesture combines a React web frontend with a native iOS shell. The iOS
app presents the frontend in a `WKWebView` and provides native camera, hand-pose,
and speech capabilities through a JavaScript bridge.

Please merge freely to `dev`, but open a PR for `main`, which will be merged
after team approval during daily scrum.

## Native iOS app

See the [native iOS runbook](Docs/NATIVE_IOS_RUNBOOK.md) for setup and
simulator builds, and the [beginner Xcode device guide](Docs/NATIVE_IOS_XCODE_DEVICE_GUIDE.md)
for step-by-step instructions to build, install, and test on an iPhone or iPad.

## Web frontend

Install [Bun](https://bun.sh/) and run the frontend from the repository root:

```bash
bun install
bun run dev
```

Run frontend tests with `bun test` and create a production build with
`bun run build`.

## Repeatable evaluation fixtures

From the repository root, run the synthetic reporting check without a model,
camera, network, or raw recordings (Node.js 22.6+):

```sh
npm run evaluate:asl -- fixtures/asl-evaluation/validation.json fixtures/asl-evaluation/test.json 0.7
```

With Bun, use `bun run scripts/evaluate-asl.ts` with the same three arguments.
Run its regression tests with `npm test -- src/test/asl-evaluation.test.ts`
(requires Node.js 22.6+ and installed development dependencies).

These are **invented prediction records**, not model results or measurements of
real signers/devices. See the [fixture protocol, expected results, consent and
deletion rules, and limitations](Docs/ASL_translation_hackathon_plan.md#p07-fixture-protocol)
before collecting or evaluating human samples.
