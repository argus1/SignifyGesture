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

See [the native iOS runbook](Docs/NATIVE_IOS_RUNBOOK.md) for setup, simulator
builds, and device testing.

## Web frontend

Install [Bun](https://bun.sh/) and run the frontend from the repository root:

```bash
bun install
bun run dev
```

Run frontend tests with `bun test` and create a production build with
`bun run build`.
