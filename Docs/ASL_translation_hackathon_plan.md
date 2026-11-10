# SignifyGesture — Four-Day Hackathon Sprint Plan

## Sprint goal

Build and present an accessible iOS prototype that recognizes a small, clearly disclosed set of **isolated ASL signs** and turns recognized words into editable text and optional speech. The demo must run with on-device Apple frameworks and expose an alternate AWS inference route behind the same provider interface. Treat recognition as an assistive prototype, not a general-purpose ASL translator, certified Telecommunications Relay Service (TRS), or substitute for a qualified interpreter.

The event page describes the FIG AI Design Makeathon as November 7–11, 2026, with a November 14 winner announcement. This is a four-working-day sprint plan within that event window; reserve November 11 for submission, contingency, or final polish if needed.

## Team and ways of working

| Team member | Primary ownership | Cross-support |
|---|---|---|
| Senior developer | App architecture, inference-provider contract, local/AWS integration, build and release checks | Pair with junior contributors; review privacy and technical risks |
| UI/UX designer | Research, flows, wireframes, visual system, HIG review, demo narrative | Join usability tests and accessibility QA |
| Cross-functional A | Camera/Vision and local inference implementation | Prototype interaction details and test scripts |
| Cross-functional B | AWS route, app integration, QA automation/manual test matrix | Design-system implementation and usability/accessibility checks |

Use a Kanban board with **Backlog → Ready → In Progress → Review/Test → Done**. Keep work small, assign one driver and one reviewer per issue, and pull work by readiness rather than by issue number. The issue set below identifies genuine technical dependencies, but UI, AWS contract work, dataset/evaluation design, and the local pipeline can proceed in parallel. Revisit scope at the end of each day; protect the demo path before adding polish.

### Definition of done for the sprint

- A fresh checkout can run the demo on a supported iPhone/iOS setup using documented steps.
- The same app can select local inference or an explicitly enabled AWS endpoint; local inference is network-independent when a compatible model is bundled. Until P08 model and confidence checks pass, the app must report no-result rather than imply offline recognition. Cloud mode sends landmarks only and reports network/service errors visibly.
- The team can demonstrate a small isolated-sign vocabulary, confidence/uncertainty, transcript correction, and user-controlled speech. The tested vocabulary, signer coverage, and measured results are visible in the demo or README.
- Camera/cloud consent, privacy limits, accessibility alternatives, and prototype limitations are explained in the UI and pitch.
- No captured video, landmarks, transcript, or audio is retained by default. Demo/testing uses synthetic content or consented data only.
- Accessibility and performance observations, known failures, and next steps are documented; do not present unmeasured accuracy or compliance claims.

## Four-day execution outline

### Day 1 — Align, scope, and unblock

- [x] Use this five-gloss ASL Citizen100 demo vocabulary: `RESEARCH1`, `DEVELOP1`, `CLOUD1`, `EDIT1`, and `DECIDE1`. These frequent labels connect to the judges’ AI/research, engineering, cloud, design, and product-strategy backgrounds; describe them as isolated glosses, not sentences or translation.
- [x] Set the demo audience as makeathon judges unfamiliar with ASL and scope the demo to one isolated gloss at a time. Out of scope: continuous signing or sentence translation, fingerspelling, facial/non-manual markers, signs outside the five-label vocabulary, and emergency, medical, or other high-stakes communication.
- [ ] Designer + cross-functional B map the primary flow, alternatives to camera/speech, error states, and a first low-fidelity wireframe.
- [x] Senior developer creates the native project shell and defines a stable `LandmarkFrame` / `SignInferenceProvider` boundary. The XcodeGen-generated iOS Simulator build passes; physical-device validation remains open.
- [ ] Cross-functional A verifies the supported iPad camera/Vision hand-pose path and separately confirms Core ML model/data availability. The native capture and Vision path is implemented, but has not yet been exercised on a physical device.
- [ ] Cross-functional B sketches the AWS request/response contract and confirms account, region, access, and spend availability before provisioning anything.
- [x] Define a signer-independent test protocol using the official ASL Citizen train/validation/test splits, with at least 3 signers and 5 trials per gloss where licensing permits; otherwise use separately consented signer-created samples and record split deviations. Report per-gloss outcomes, confusion/no-result rates, confidence behavior, and on-device end-to-end latency; do not claim measured performance before running the protocol.
- [ ] Start a Lovable credit ledger by member before generating prototypes.
- [ ] Scope optional intelligent help (P16): confirm frontend ownership, screen/control identifiers, demo-device AFM availability, and reviewed help topics. No cloud provisioning is required for this decision.
- [ ] Start offline operation (P17 · #20): test whether the current TanStack Start/Nitro production build can run as bundled static assets; keep the LAN development workflow unchanged and record build/runtime blockers before selecting an approach.

### Day 2 — Build parallel vertical slices

- [x] Implement native camera-permission rationale and recovery, camera preview with an always-available stop control, Vision pose extraction, and visible tracking state. Simulator builds pass; physical-device behavior and camera/Vision coordinate mapping still need verification.
- [ ] Build a clickable Lovable prototype for flows and interaction review; use it as design evidence, not as the native iOS deliverable.
- [ ] Implement the local inference adapter and evaluation harness against a fixed input shape; if a suitable model is unavailable, clearly label the limited baseline and keep the interface ready for a model.
- [ ] Implement and test the AWS endpoint independently against the same contract; do not upload camera frames.
- [ ] Review wireframes/prototype against VoiceOver, Dynamic Type, contrast, safe areas, and reduced-motion needs.
- [ ] If the static-build spike passes, package frontend assets in the existing WKWebView app and bundle required fonts/assets; otherwise stop the offline release slice and retain the working LAN flow. Do not switch frameworks on the critical path.

### Day 3 — Connect the user journey and validate

- [ ] Connect recognition to an editable transcript, explicit speak/replay controls, and a stop/mute control.
- [ ] Add local/AWS selection, cloud opt-in, endpoint/service status, timeouts, and visible failure/retry behavior.
- [ ] Run the fixed evaluation across the agreed signs and signer samples; capture per-class results, confusion cases, confidence behavior, and measured latency.
- [ ] Conduct short task-based usability/accessibility checks; include Deaf/HoH participants when available and record when they are not.
- [ ] Complete privacy/threat-model and standards-scope review. Fix high-severity issues before adding optional features.
- [ ] Exercise bundled frontend routes and the native bridge with networking disabled; confirm cloud/AWS actions fail visibly and that local data behavior does not imply a successful AWS sync.
- [ ] Only if the core demo is stable, begin the optional avatar mirroring slice; keep it off the critical path.
- [ ] If the core demo is stable, integrate the optional P16 help panel and bounded navigation tools; use on-device AFM where available and retain conventional help everywhere. Cloud help remains separately opt-in and subject to account-owner approval.

### Day 4 — Stabilize, demo, and hand off

- [ ] Rehearse a clean-install end-to-end demo in local mode and, if provisioned, AWS mode; verify offline behavior and failure states.
- [ ] For P17, install a clean build and test in airplane mode, then retest LAN-based development. Record device/OS coverage and any remaining offline blockers.
- [ ] Run the accessibility checklist on device, test the full permission/denial/revocation flow, and check transcript corrections and speech controls.
- [ ] Include avatar mirroring only if it is complete, understandable, and does not displace core reliability or accessibility fixes.
- [ ] Include intelligent help only if P16 acceptance checks pass; otherwise defer the agent and retain conventional help. Record provider/device coverage, observed latency, and known limitations.
- [ ] Capture a short demo, final wireframes/prototype link, measured results, architecture diagram, setup notes, and known limitations.
- [ ] Stop optional feature work; fix only issues that block the demo, mislead users, expose data, or materially block access.
- [ ] Reserve November 11 as event-window contingency/submission time if the team’s four sprint days finish earlier.

## Lovable credit plan

The team has **4 × 100 = 400 credits total** under the stated hackathon allowance. Credits are per member; do not assume they can be pooled or transferred. Lovable is for a fast clickable UI/UX prototype and iteration, not the SwiftUI/iOS implementation or the Core ML/AWS inference runtime.

- [ ] Have one member own each Lovable project/session to avoid duplicate generations; invite the others to review the resulting prototype.
- [ ] Track member, prompt/change, credits used, and remaining credits in a shared lightweight ledger.
- [ ] Set a team working cap of **75 credits per member** for planned prototyping and iteration, reserving **25 each (100 total)** for late usability fixes or export/revision needs.
- [ ] Prefer small, targeted prompt changes; validate flows and responsive states before spending on visual variations.
- [ ] Export/share the chosen prototype and record its URL in the handoff issue. Confirm actual credit usage in Lovable because usage may vary by action.

## Product and architecture guardrails

- **Narrow the promise:** isolated signs in a fixed vocabulary for a hackathon demo; not continuous ASL sentence translation, universal signer recognition, emergency communication, medical use, or a replacement for interpreters/TRS.
- **Local path:** SwiftUI + AVFoundation camera frames + Apple Vision hand-pose observations + a Core ML model when a suitable model is available. Process frames/landmarks locally. Vision hand observations should be treated as 2D image-space points with confidence unless the implementation explicitly establishes a valid depth source.
- **AWS path:** same app/provider contract and input normalization; send only normalized landmark sequences over TLS to an authenticated, budget-limited inference API (for example API Gateway/Lambda for a small CPU model). Never upload raw camera frames for this sprint. AWS deployment is subject to account/region/budget access.
- **Optional avatar mirroring:** after the core flow is working, reuse local Vision landmarks to animate a simple SwiftUI 2D/2.5D avatar or pose overlay. A 3D/VRM/Unity route is a stretch only when a suitable licensed asset and runtime already exist. Mirroring is visual pose feedback, not sign translation or validation; keep it optional, local, and removable without affecting the main flow.
- **No fabricated fallback:** a missing model, low-confidence result, unavailable endpoint, or permission denial must be visible and recoverable, not rendered as a confident translation.
- **Human agency:** show the recognized text before speech; allow edit, clear, repeat, and mute/stop. Provide a usable non-camera/non-speech route through the prototype and explain limitations.
- **Data minimization:** no account, analytics, raw media upload, or retention is needed for the hackathon. If a cloud request is enabled, obtain explicit opt-in and disclose what is sent, where it goes, and retention. Use synthetic data for demos; do not enter health or other sensitive conversations.
- **Model/data readiness is a Day 1 gate:** document model license, provenance, vocabulary, expected landmark convention, signer coverage, and test split. If no suitable model/data is available, demo tracking and a clearly labeled constrained baseline; do not call it reliable ASL translation.
- **Optional intelligent help:** a bounded assistant explains reviewed app features, highlights controls, and proposes navigation through allowlisted app APIs. It is not a sign-recognition/translation provider, autonomous screen-clicker, interpreter, or source of medical/emergency advice. Keep it independent of the inference-provider contract and outside the core demo's critical path.
- **Help-provider availability and consent:** preserve the iOS 17 minimum. Compile AFM integration with a supporting SDK, availability-gate it to iOS/iPadOS 26+, and check `SystemLanguageModel` readiness on eligible Apple Intelligence devices. Always retain conventional help. Cloud help requires its own explicit disclosure/opt-in, independent of landmark-inference consent; never silently send an on-device conversation to a cloud model.
- **Help context and execution:** expose only the current screen, allowlisted controls, feature readiness, permission state, and relevant error codes. Exclude video, landmarks, transcript, and audio; do not retain help conversations or log their bodies by default. Validate model-proposed actions against current app state, preserve native permission flows, and require explicit user action before capture, speech, uploads, or settings changes.

## Regulatory and accessibility checkpoints

Use the repository’s [`Standards/`](../Standards/) documents as design and risk inputs, not as a claim that the prototype is legally compliant. The sprint is not legal advice; avoid claims of ADA, FCC/TRS, or HIPAA compliance without qualified review.

- [ ] **Effective communication and user choice:** the ADA.gov guidance in `Standards/ADA Requirements_ Effective Communication _ ADA.gov.pdf` discusses covered entities’ effective-communication duties and selecting aids/services in context. Do not imply this app alone satisfies those duties; provide clear text, user correction, status/error information, and alternate interaction paths.
- [ ] **TRS boundary:** `Standards/47 CFR Part 64 ...pdf` and `Standards/47 CFR Part 9 Subpart E ...pdf` concern telecommunications relay rules. Do not market or operate this prototype as FCC-certified TRS, a communications assistant, a 911/relay replacement, or a qualified interpreter.
- [ ] **Healthcare boundary:** the HHS FAQ in `Standards/When a covered entity ...pdf` concerns a certified TRS and a specific HIPAA Privacy Rule scenario. It does not establish that this app or an AWS deployment is HIPAA-compliant or exempt. Use synthetic demo text; do not process PHI.
- [ ] **Multiple access needs:** the TRS Working Group report in `Standards/TRS WG Report - DAC Final.508.pdf` highlights that communication needs vary. Do not assume one output mode or one signer represents all users; invite Deaf/HoH feedback where feasible and report the limits of testing.
- [ ] **Apple HIG:** use VoiceOver labels/order, Dynamic Type, adequate contrast, large clear targets, visible focus/status, safe-area layouts, and reduced-motion support. Never communicate camera, recognition, or network state through color alone.
- [ ] **Avatar accessibility:** make motion optional, honor reduced-motion preferences, and provide a text/preview alternative with accessible tracking state; the avatar must not obscure the transcript or controls.
- [ ] **Consent and control:** explain camera use before the permission prompt; explain landmark upload before cloud mode; provide cancel/disable controls; make speech opt-in and interruptible.
- [ ] **No overclaiming:** show an “experimental / limited vocabulary” disclosure and an uncertainty state; do not describe the output as a verbatim or certified translation.

## Issue board (16 Kanban-sized work items)

Each issue body is intentionally actionable on its own. Add the available repository labels (`enhancement`, `accessibility`, `help wanted`, or `documentation`) as appropriate; issue numbers/links are added after creation.

### [P01 · #1](https://github.com/argus1/SignifyGesture/issues/1) — Set demo scope, vocabulary, and evaluation protocol

**Track:** Product / research · **Suggested owner:** Senior developer + designer · **Can start:** Day 1

**Goal:** Bound the prototype to a small isolated-sign vocabulary and define how the team will evaluate it without overstating capability.

**Current scope and vocabulary:** The demo audience is makeathon judges who may not know ASL. Show one isolated gloss at a time using `RESEARCH1` (research), `DEVELOP1` (develop), `CLOUD1` (cloud), `EDIT1` (edit), and `DECIDE1` (decide), selected for likely familiarity with the judges’ AI/research, engineering, cloud, design, and product-strategy work. Out of scope: continuous signing or sentence translation, fingerspelling, facial/non-manual markers, any gloss outside this five-label set, and emergency, medical, or other high-stakes communication. The English words are cue/label meanings, not a claim that the app translates English phrases into ASL or vice versa.

Each selected label appears in the official ASL Citizen train, validation, and test metadata. In the test split, the labels have 14–17 clips apiece and coverage from 10–11 signers, sufficient for a test target of at least 3 signers and 5 trials per gloss. The protocol is to preserve the published signer-independent split, use validation only for model selection and confidence/no-result threshold setting, and report test results separately for every gloss. These are dataset availability counts, not this app’s recognition results or proof of signer-reviewed meanings.

**Data/model decision:** The supplied article evaluates an ASL Citizen100 subset (100 gloss classes, 3,544 videos from 45 signers), but does not name its glosses or report per-gloss results. It describes a multimodal RGB/pose model; its pose baseline uses 67 three-dimensional landmarks per frame, which is not the same input contract as Apple Vision’s 2D hand-pose observations. The paper and the project repository do not provide a confirmed, app-ready Core ML model/checkpoint. Therefore, no sign-recognition model is currently approved for the demo. Unless a compatible model and its license are verified, the honest fallback is tracking/status plus an explicit no-result state—not a mock or guessed sign prediction.

The project owner confirms ASL Citizen may be used for local model training, provided the dataset, derived materials, and trained artifacts remain local, untracked, and are not pushed or redistributed. Keep them under the ignored `local-data/asl-citizen/` directory and continue to follow the official [Microsoft Research license](https://www.microsoft.com/en-us/research/project/asl-citizen/dataset-license/), including its non-commercial research-use and redistribution restrictions. A CI check rejects ASL Citizen-named paths and common dataset/media/model artifact files if they are tracked. The five labels/counts inform scope only. The supplied paper is not Apple research; Apple’s [sign-language annotation research](https://machinelearning.apple.com/research/sign-language-annotations) reports an isolated-sign baseline on ASL Citizen but does not provide a ready-to-use model or a short list of demo glosses.

**Current blocker:** The repository has no compatible model or consented prediction set, so this issue's accuracy, recall, confidence, and latency results cannot yet be measured. Local training may proceed under the data-handling constraints above; do not use the dataset's listed clips as this app's results, and do not close this evaluation item with simulated predictions. The native app now surfaces the unavailable-model/no-result reason instead of implying that tracking means recognition.

**Reproducible evaluation:** `scripts/evaluate-asl.ts` accepts one JSON array for validation and one for test. Each row contains `trialId`, pseudonymous `signerId`, `split`, `expectedGloss`, `predictedGloss` (use `null` for no result), `confidence` (use `null` for no result), and `latencyMs`. Keep the files local; do not include media, dataset clip IDs, names, or other identifying data. The tool rejects overlapping validation/test signers, reports one-vs-rest accuracy and recall per gloss, precision, confusion and no-result counts, test coverage, confidence/coverage tradeoffs, and latency percentiles. It reports the validation threshold sweep but never selects a threshold automatically; rerun the test report with a threshold present in that validation sweep:

```sh
bun run scripts/evaluate-asl.ts validation.json test.json <threshold-from-validation-sweep>
```

For native results, record the optional `latencyMs` delivered with each prediction/no-result. It measures from the first Vision landmark frame in the 16-frame input window until inference completes. Let tracking become lost between isolated trials so the app clears the preceding sequence and same-gloss suppression.

For real samples, only claim the planned signer coverage when `test.coverageRequirements.meetsMinimum` is true and provenance confirms actual human signers. Synthetic IDs can exercise the count check but cannot establish human coverage. If consented collection cannot meet it, record the actual counts and deviation instead of implying the target was met.

References: [Alkhoraif’s paper](https://doi.org/10.1016/j.jer.2025.07.006), Microsoft’s [ASL Citizen dataset description](https://www.microsoft.com/en-us/research/project/asl-citizen/dataset-description/), and its [dataset license](https://www.microsoft.com/en-us/research/project/asl-citizen/dataset-license/).

- [x] Record the five selected glosses, an explicit out-of-scope list, and a small set of non-sensitive test cues: one isolated prompt per gloss—“research,” “develop,” “cloud,” “edit,” and “decide.” Do not combine them into phrases for recognition.
- [x] Document dataset provenance, label coverage, published landmark convention, and license restriction. No app-ready compatible model/checkpoint is confirmed; use tracking plus no-result until a compliant model path is verified.
- [x] Define a repeatable signer-independent test split using the official test partition if permitted; otherwise use consented data and document any deviation. The five selected labels have sufficient listed test coverage to exceed 3 signers and 5 trials each.
- [x] Add an evaluation tool that keeps validation threshold selection separate from signer-disjoint test reporting; it uses only label/prediction metadata, never media.
- [ ] Report per-class accuracy/recall, confusion cases, confidence behavior, and end-to-end latency; do not hide weak classes behind an aggregate.
- [x] Limitation statement: “Experimental demo for five isolated ASL glosses only. It does not translate sentences or replace an interpreter. Results can be wrong; review and edit the text. Do not use for emergency or other high-stakes communication.” Show no result when tracking/input is invalid, the model is unavailable, the output is outside the five supported labels, or the validation-set confidence threshold is not met. Do not invent a numeric threshold before validation.

**Acceptance:** Scope, data/model decision, protocol, and limitations are committed in the repo or linked from the demo issue; no claim of continuous translation or validated general ASL capability.

### [P02 · #2](https://github.com/argus1/SignifyGesture/issues/2) — Map accessible capture and translation user flows

**Track:** UX · **Suggested owner:** Designer + cross-functional B · **Can start:** Day 1

**Goal:** Map the primary interaction and non-happy paths before UI implementation.

- [ ] Wireframe onboarding, camera permission rationale/denial, capture, recognition/uncertainty, transcript edit, speak/stop, local/cloud choice, and settings.
- [ ] Include no-camera and no-audio alternatives, no-hands/poor-lighting states, network/model errors, and a clear way to stop/clear.
- [ ] Show state with text/icon plus color; plan for VoiceOver reading order, Dynamic Type, large touch targets, contrast, and safe areas.
- [ ] Review the flow with one Deaf/HoH or accessibility-informed reviewer if available; record feedback or note that it remains unvalidated.

**Acceptance:** Linked wireframes cover the full flow and key failure/permission states; design handoff identifies labels, status announcements, and interaction behavior.

### [P03 · #3](https://github.com/argus1/SignifyGesture/issues/3) — Build a Lovable clickable prototype and UI kit

**Track:** UX / prototype · **Suggested owner:** Designer · **Can start:** Day 1

**Goal:** Produce a navigable concept quickly without conflating the web prototype with the native iOS implementation.

- [ ] Create a small UI kit: typography, color/contrast tokens, spacing, controls, status/uncertainty treatments, and responsive layouts.
- [ ] Implement a clickable flow from onboarding through corrected transcript and optional speech, including denied permission and cloud-off states.
- [ ] Use a per-member credit ledger; keep planned use to 75 credits/member and retain the other 25 for late revisions.
- [ ] Test prototype flows with teammates and at least one external reviewer if feasible; make focused changes rather than regenerating the whole app.
- [ ] Share/export the prototype and record its URL and credit use in the handoff.

**Acceptance:** Prototype is viewable by the team, covers the agreed key states, and is explicitly labeled as a design prototype rather than the runnable iOS app.

### [P04 · #4](https://github.com/argus1/SignifyGesture/issues/4) — Scaffold native iOS app and inference-provider contract

**Track:** iOS foundation · **Suggested owner:** Senior developer · **Can start:** Day 1

**Goal:** Establish the smallest native app structure and the seam that lets local and AWS inference run the same demo.

- [x] Add an Xcode/SwiftUI app target and document supported Xcode/iOS/device assumptions.
- [ ] Define typed normalized landmark/frame, prediction (label + confidence), provider configuration, and error models.
- [ ] Define `InferenceProvider` implementations for local and AWS modes; make local the default and avoid silent fallback.
- [ ] Add a simple app state flow and dependency injection/test seam so UI can be exercised with a mock provider.
- [x] Document build/run steps and required permission strings; do not add unrelated packages or account features.

**Acceptance:** App builds on a supported simulator/device, mock inference can drive the UI, and both provider choices share a documented input/output contract.

### [P05 · #5](https://github.com/argus1/SignifyGesture/issues/5) — Implement camera permission, preview, and lifecycle

**Track:** iOS / capture · **Suggested owner:** Cross-functional A · **Can start:** Day 1

**Goal:** Capture frames safely and predictably for the Vision processing path.

- [x] Request camera access only after explaining why it is needed; handle denied/restricted/revoked access with a usable explanation and retry/settings path. Device permission flows remain unverified.
- [x] Add a front-camera preview with capture start/stop tied to view lifecycle and a visible camera-active indicator. Backgrounding or leaving the shell stops capture; the user can restart from the web UI.
- [x] Configure frame delivery off the UI thread, discard stale frames, and expose actionable errors rather than swallowing them.
- [ ] Verify app behavior when entering background, leaving the screen, and stopping/restarting capture.

**Acceptance:** On a supported device, the user can grant/deny/revoke camera access and start/stop preview without a frozen UI or unhandled permission state.

### [P06 · #6](https://github.com/argus1/SignifyGesture/issues/6) — Extract and normalize Vision hand landmarks

**Track:** iOS / perception · **Suggested owner:** Cross-functional A + senior reviewer · **Can start:** Day 1

**Goal:** Convert Vision observations to a stable, documented inference input.

- [x] Extract the supported hand joints and confidence values for up to two hands; represent missing joints/hands explicitly.
- [x] Normalize orientation, mirroring, hand ordering, coordinate range, and confidence according to the documented model contract.
- [x] Keep frame processing off the main thread and avoid overlapping unbounded inference work.
- [x] Add an opt-in debug landmark inspector; latest-frame data stays in memory and is cleared when capture stops.
- [x] Verify coordinate mapping with known poses and document Vision’s 2D image-space limitations.

The landmark contract is 2 hands × 21 joints × (x, y, confidence), with left/right slots fixed by chirality, coordinates upright relative to gravity, unmirrored and top-left-origin in [0, 1], and missing values zero-filled. Unknown chirality is reported instead of assigned to Right. Follow-up device tests confirmed upright portrait/landscape inspector orientation, correct anatomical labels and movement, and mirrored inspector display. After independent preview-layer rotation handling was added, the tester confirmed the camera preview works in both landscape and portrait directions on November 10, 2026. All 10 native simulator tests pass; this verifies landmark mapping, not recognition-model accuracy or coverage across all devices.

**Acceptance:** A deterministic landmark sequence can be produced from live capture and fixture input with tested ordering, missing-point, orientation, and confidence behavior.

### [P07 · #7](https://github.com/argus1/SignifyGesture/issues/7) — Create consented fixtures and a repeatable evaluation harness

**Track:** Data / QA · **Suggested owner:** Cross-functional B + designer · **Can start:** Day 1

**Goal:** Make model iteration measurable while limiting collection and storage.

- [ ] Use synthetic/consented samples only; explain purpose, storage, and deletion before recording any teammate or participant. The authored suite is entirely synthetic and the disclosure is documented, but consented human collection remains outstanding.
- [x] Prefer landmark-only fixtures; do not commit identifiable video or audio to the repository. This reporting suite needs only synthetic prediction metadata, not even landmarks.
- [ ] Separate train/tuning and evaluation by signer where possible; record the actual split and sample counts. Synthetic validation/test identities are disjoint; real collection and cross-export signer separation remain outstanding.
- [x] Add `scripts/evaluate-asl.ts` to report per-class results, confusion matrix, confidence/abstention, signer coverage, and latency. Automated tests use generated records only; actual results still require a compatible, licensed model and permitted or consented samples.
- [x] Write down data gaps, signer/device/lighting limitations, and whether external Deaf/HoH review occurred. See the fixture protocol below; no human/device or external review coverage is established.
- [x] Implement Debug-only native landmark trial capture, review/discard, and explicit local JSON export. Synthetic simulator tests pass; no S3 upload is implemented.
- [ ] Physically verify capture/export/deletion on the demo device.
- [ ] Recruit and obtain informed consent from three signers; capture five trials per signer for each of the five glosses (75 trials). Establish signer-disjoint train/validation/test assignments, recruiting additional signers if all three are used for training. This is pilot collection, not proof of sufficient training data.
- [ ] Add separately consented S3 upload after an authenticated backend, private storage/retention/deletion policy and AWS access are approved (deferred; local export first).

**Acceptance:** Another teammate can run the documented evaluation on fixtures and reproduce the reported measurements without accessing raw recordings.

#### P07 fixture protocol

**Provenance and scope:** The checked-in files
[`validation.json`](../fixtures/asl-evaluation/validation.json) and
[`test.json`](../fixtures/asl-evaluation/test.json) contain manually invented
prediction records. Labels come from the five-gloss scope; no ASL Citizen clips,
derived landmarks, model outputs, participant data, or recordings were used.
Every identity/trial is prefixed `synthetic-`. Confidence and latency values are
deliberately assigned to exercise the reporter. This is a reporting regression
suite, not an inference fixture, a recognition baseline, or measured performance.
It is never loaded into the app as a fallback.

| Partition | Records | Invented signer IDs | Records per gloss | Human signers |
|---|---:|---|---:|---:|
| Train | 0 | None | 0 | 0 |
| Validation/tuning | 5 | `synthetic-validation-a` | 1 | 0 |
| Test | 25 | `synthetic-test-a`, `synthetic-test-b`, `synthetic-test-c` | 5 | 0 |

Validation and test share no signer IDs. There is no training run or official
dataset split in this suite. For future real exports, keep all sessions from a
signer in one partition, preserve official splits where licensed, and record
train/validation/test counts, per-gloss counts, deviations, and model provenance
locally. Do not tune a model or threshold on test predictions. The reporter checks
validation/test signer overlap; training separation must also be verified by the
exporter because training records are not an input to this reporting tool.

**Run and reproduce:** From the repository root, with Node.js 22.6+:

```sh
npm run evaluate:asl -- fixtures/asl-evaluation/validation.json fixtures/asl-evaluation/test.json 0.7
npm test -- src/test/asl-evaluation.test.ts
```

The CLI itself uses no third-party packages. Tests require the project's installed
development dependencies. Bun can also run the existing CLI:

```sh
bun run scripts/evaluate-asl.ts fixtures/asl-evaluation/validation.json fixtures/asl-evaluation/test.json 0.7
```

The threshold `0.7` is a synthetic validation-sweep candidate chosen to exercise
both acceptance and abstention, **not an approved production threshold**. The
JSON report on stdout includes the full validation sweep and test confusion matrix.
Malformed records, overlapping validation/test signers, and thresholds absent
from the validation sweep fail explicitly. Keep reports from real samples local.

**Expected synthetic output at `0.7`:**

| Expected gloss | Support | Correct | Wrong label | No result | One-vs-rest accuracy | Precision | Recall |
|---|---:|---:|---:|---:|---:|---:|---:|
| RESEARCH1 | 5 | 2 | 1 | 2 | 0.84 | 2/3 | 0.40 |
| DEVELOP1 | 5 | 2 | 1 | 2 | 0.84 | 2/3 | 0.40 |
| CLOUD1 | 5 | 3 | 1 | 1 | 0.88 | 0.75 | 0.60 |
| EDIT1 | 5 | 3 | 1 | 1 | 0.88 | 0.75 | 0.60 |
| DECIDE1 | 5 | 3 | 1 | 1 | 0.88 | 0.75 | 0.60 |

- Test: 13/25 correct (0.52 accuracy), 18/25 covered (0.72), 7/25 abstained
  (0.28), and 13/18 selective accuracy. Abstentions count as incorrect in overall
  accuracy. Per-class accuracy is one-vs-rest, not recall.
- The five wrong-label cells form the cycle RESEARCH1 → DEVELOP1 → CLOUD1 →
  EDIT1 → DECIDE1 → RESEARCH1, one each. `NO_RESULT` includes five
  low-confidence predictions, one unsupported label despite confidence 0.99,
  and one explicit null prediction. A confidence equal to the threshold is accepted.
- Confidence: 24 scored predictions, mean 0.77875, median 0.9, range 0.4–0.99;
  explicit null predictions are excluded. Confidence includes scores later
  abstained from, not just accepted predictions; this is not calibration evidence.
- Assigned latency inputs: mean/median 22 ms, p95 33 ms (nearest-rank percentile).
  These are not timings of the script, inference, or an iPhone.
- The synthetic count check passes with three invented IDs/five trials per class.
  It does **not** meet the requirement for three actual signers.

**Before any future participant capture:** Explain the following in accessible
text and confirm affirmative, voluntary consent before enabling capture. If the
participant declines or withdraws, do not record; use synthetic samples instead.
This suite requires no participant recruitment or capture.

- **Purpose and choice:** Small-vocabulary isolated-sign evaluation only, not
  sentence translation or proof of linguistic correctness. Explain whether data
  is for training, validation, or held-out evaluation. Participation is optional
  and can stop at any time without losing access to the non-camera app.
- **What is stored:** Prefer normalized landmarks plus pseudonymous trial/signer
  IDs, labels, confidence, and latency; for reporting, retain prediction metadata
  only. Landmarks can still be identifying; do not describe them as anonymous.
  Do not retain raw video/audio, names, transcripts, or sensitive conversations
  for this evaluation. Any proposed raw recording requires a separate reviewed
  purpose, consent, storage/deletion plan, and approval before recording.
- **Where and access:** Keep human-derived fixtures, reports, and consent records
  on the collecting teammate's access-controlled device under ignored
  `local-data/consented-fixtures/`, never Git, issue attachments, shared logs,
  cloud sync, or inference uploads. Keep any identity/withdrawal lookup separate
  from exports. ASL Citizen materials remain under their existing separate local
  directory/license restrictions; participant consent does not override them.
- **Retention and deletion:** State the collector responsible and exact deletion
  time before capture. Default to deleting human-derived samples, exports,
  reports, and lookup records at the end of the session, no later than 24 hours
  after capture; any extension needs new explicit consent before retention.
  Give the participant a private withdrawal route and trial/signer reference.
  On withdrawal, stop collection and remove associated samples and derivatives,
  including any training artifacts that used them, and confirm deletion.
  Do not copy to backups or systems where that promise cannot be honored.
- **Commit boundary:** Only authored synthetic fixtures belong in this repository.
  Review staged files before committing; the ignore rule is not a privacy or
  consent enforcement mechanism. Do not commit real landmark arrays or metadata
  simply because no video/audio is attached. Synthetic fixture files can be
  deleted locally, but committed history persists; never put participant data
  there in the first place.

**Data gaps and review status:** This suite covers reporter logic only. No human
signing, handedness, signing variation, skin tone, mobility range, occlusion,
camera distance, device/OS, or lighting condition is represented. There is no
compatible model evaluated by this suite, no measured on-device latency, no
confidence calibration, and no evidence of real signer-independent recognition.
No external Deaf/HoH review is recorded for these fixtures; vocabulary meaning,
usability, and acceptability still require qualified human review. Keep P01's
real recognition-results checklist item open until permitted samples and an
approved compatible model are actually evaluated. Do not present these synthetic
numbers as the app's accuracy or performance.

### [P08 · #8](https://github.com/argus1/SignifyGesture/issues/8) — Add local on-device inference adapter

**Track:** ML / iOS · **Suggested owner:** Senior developer + cross-functional A · **Can start:** Day 1

**Goal:** Run the constrained recognition path locally without a network dependency.

- [ ] Verify that the selected model exists, is licensed for the demo, and matches the normalized Vision input; if not, use a clearly labeled constrained baseline and document the limitation.
- [ ] Package/load the Core ML model where appropriate and map its output to the shared prediction type.
- [ ] Handle warm-up, no-result/low-confidence, unsupported model, and inference errors explicitly.
- [ ] Confirm that local mode sends no camera frames or landmarks over the network and works with connectivity disabled.
- [ ] Measure inference and end-to-end latency on the demo device; report hardware and test conditions.

**Acceptance:** On a documented compatible iPhone, local mode produces a prediction/no-result from fixture and live input while offline; limitations and measured results are recorded.

### [P09 · #9](https://github.com/argus1/SignifyGesture/issues/9) — Implement opt-in AWS inference route for landmarks

**Track:** Cloud / API · **Suggested owner:** Cross-functional B + senior reviewer · **Can start:** Day 1

**Goal:** Provide an alternative runnable inference provider without transmitting raw video.

- [ ] Implement a small HTTPS API accepting only versioned normalized landmark sequences and returning the shared prediction type.
- [ ] Use an explicitly selected, budget-limited AWS deployment (for example API Gateway + Lambda for a small CPU model); document required region, configuration, and teardown.
- [ ] Require an app-level cloud opt-in; use TLS, least-privilege IAM, input size/rate limits, and no request-body logging or payload retention by default.
- [ ] Return explicit timeout, unavailable, invalid-input, and low-confidence responses; do not silently substitute a prediction.
- [ ] Test the deployed endpoint with fixtures and a command-line smoke test. Never provision resources or spend AWS funds without the account owner’s authorization.

**Acceptance:** With valid AWS credentials/resources, a teammate can deploy and smoke-test the route using landmark fixtures; privacy behavior, costs/limits, and cleanup steps are documented. If credentials are unavailable, record the blocker and keep the API contract/test runnable locally.

### [P10 · #10](https://github.com/argus1/SignifyGesture/issues/10) — Add inference mode selection and cloud privacy controls

**Track:** Product / integration · **Suggested owner:** Senior developer + designer · **Can start:** Day 2

**Goal:** Let users choose the runtime knowingly and make failure states understandable.

- [ ] Make on-device mode the default; provide an explicit cloud-mode choice and explain that landmark data leaves the device.
- [ ] Show selected mode, consent state, service/model readiness, and network errors in accessible text.
- [ ] Add timeout/retry/cancel behavior and preserve the transcript if the endpoint is unavailable.
- [ ] Verify local mode remains usable offline and cloud requests contain landmarks only.
- [ ] Provide a way to turn cloud mode off and clear local demo state.

**Acceptance:** A tester can identify the active mode, opt into/out of cloud use, observe a simulated service failure, and continue locally without hidden upload or data loss.

### [P11 · #11](https://github.com/argus1/SignifyGesture/issues/11) — Add transcript review and user-controlled speech

**Track:** UX / iOS · **Suggested owner:** Designer + cross-functional B · **Can start:** Day 2

**Goal:** Keep the user in control of recognized content and audio output.

- [ ] Display the recognized result and uncertainty before speaking; never auto-speak a low-confidence result.
- [ ] Allow edit, clear, copy, replay, mute, and immediate stop using accessible controls.
- [ ] Speak only after explicit user action; handle empty text, interruptions, and speech errors.
- [ ] Keep text visible while audio plays and announce state changes accessibly.
- [ ] Add an alternate text-only flow when camera or speech is unavailable.

**Acceptance:** The end-to-end flow allows correction before optional speech, and speech can be stopped immediately without losing the editable text.

### [P12 · #12](https://github.com/argus1/SignifyGesture/issues/12) — Run HIG and communication-accessibility QA

**Track:** Accessibility · **Suggested owner:** Designer + cross-functional A · **Can start:** Day 2

**Goal:** Check the experience against Apple HIG principles and the repository’s communication-accessibility sources.

- [ ] Test VoiceOver labels, focus order, status announcements, Dynamic Type, contrast, target sizes, orientation/safe areas, and reduced motion.
- [ ] Verify that color is never the sole indicator and that tracking/no-result/network states are understandable as text.
- [ ] Walk the complete task flow using the wireframe/prototype and native app; include permission denial and non-camera/non-speech alternatives.
- [ ] Gather Deaf/HoH feedback if available; document who tested, the tasks, findings, and what remains unvalidated.
- [ ] Fix critical blockers and add remaining issues to the backlog with evidence.

**Acceptance:** A completed checklist and prioritized findings are linked from the demo; any untested HIG or user-research items are clearly called out.

### [P13 · #13](https://github.com/argus1/SignifyGesture/issues/13) — Review privacy, security, and regulatory boundaries

**Track:** Trust / documentation · **Suggested owner:** Senior developer + designer · **Can start:** Day 1

**Goal:** Prevent misleading claims and avoid unnecessary collection or exposure.

- [ ] Map camera frames, landmarks, predictions, transcript, audio, and cloud requests; document where each is processed and whether it is retained.
- [ ] Verify opt-in, HTTPS, least-privilege AWS access, no secrets in source control, no sensitive payload logging, and a teardown path.
- [ ] Add UI/pitch disclaimers: experimental limited vocabulary; not a qualified interpreter, certified TRS, emergency service, or medical communication product.
- [ ] Treat the ADA, FCC/TRS, and HHS PDFs as scope/risk references, not proof of product compliance or a HIPAA exemption.
- [ ] Use synthetic non-sensitive demo content; identify any legal/privacy questions that need qualified review before real-world use.

**Acceptance:** A concise data-flow/risk note and in-product disclosure are reviewed; no unapproved sensitive data or cloud resource is used in the demo.

### [P14 · #14](https://github.com/argus1/SignifyGesture/issues/14) — Integrate, rehearse, and publish the demo handoff

**Track:** Integration / release · **Suggested owner:** Whole team, driver senior developer · **Can start:** Day 3

**Goal:** Deliver a credible, reproducible demo and handoff within the sprint.

- [ ] Run clean setup/build and end-to-end checks for local mode and AWS mode if provisioned.
- [ ] Verify offline behavior, permission denial/revocation, no-hands/low-confidence, endpoint failure, transcript correction, mute/stop, and accessibility-critical paths.
- [ ] Record measured recognition results, latency/device details, limitations, and known bugs; do not substitute expected values for measurements.
- [ ] Publish setup instructions, architecture/provider diagram, prototype link, privacy/standards note, and a short demo recording or run-of-show.
- [ ] Rehearse a concise pitch that distinguishes the design prototype from the native app and communicates uncertainty and user control.

**Acceptance:** A teammate can reproduce the demo from the handoff, the live walkthrough has a tested fallback, and remaining risks are plainly listed.

### [P15 · #15](https://github.com/argus1/SignifyGesture/issues/15) — Add optional avatar mirroring of signing

**Track:** Optional UX / iOS · **Suggested owner:** Cross-functional A + designer · **Can start:** Day 3, only if the core demo is stable

**Goal:** Add a clearly optional visual avatar that mirrors detected hand poses as feedback, without implying that it interprets or validates ASL.

- [ ] Keep this outside the critical path; complete and test camera, recognition, editable transcript, and local inference first.
- [ ] Reuse local Vision landmarks to animate a simple SwiftUI 2D/2.5D avatar or hand/skeleton overlay. Consider a 3D/VRM avatar only if a suitable licensed asset and working runtime already exist; do not introduce Unity solely for the sprint.
- [ ] Match the preview’s orientation and left/right hand state; represent unavailable or occluded tracking instead of inventing poses.
- [ ] Provide a visible enable/disable setting and preserve the preview, recognized text, and non-avatar interaction as alternatives.
- [ ] Keep rendering local and avoid retaining or uploading camera frames. Check performance, contrast, reduced motion, and VoiceOver descriptions/status.
- [ ] Label it as visual pose mirroring only; it does not translate signs, reproduce full signing, certify correctness, or replace a human interpreter.

**Acceptance:** When enabled, the prototype visibly mirrors detected hand movement on a supported device; when disabled or tracking is unavailable, the core demo remains usable without introducing schedule or scope risk.

### [P16 · #18](https://github.com/argus1/SignifyGesture/issues/18) — Add optional context-aware intelligent help and navigation

**Track:** Optional UX / iOS / integration · **Suggested owner:** Senior developer + designer, cross-functional B for cloud integration · **Can start:** Day 1 for content/contracts; Day 3 integration only if the core demo is stable

**Goal:** Help users understand and navigate the app with truthful, accessible guidance grounded in reviewed content and live app state. Deliver conventional help first, then an on-device Apple Foundation Models (AFM) assistant on eligible devices. Cloud help is a separately approved extension, not a prerequisite.

**Dependencies:** P02 for reviewed flows/content and P04 for native bridge integration. Define screen/control contracts with the externally maintained Lovable frontend; its source/router is not in this checkout. P12/P13 review accessibility/privacy and P14 validates inclusion in the demo. This work does not depend on deploying P09's landmark-inference endpoint or training a recognition model.

**Implementation checklist**

- [ ] Define a versioned help-context/action contract and reviewed topics: camera permission/recovery, tracking versus recognition, model readiness, transcript correction, optional speech, and local/cloud distinctions. Match help content to the app version and actual implemented features.
- [ ] Add a discoverable text-first help panel with searchable conventional instructions, suggested questions, visible busy/error/cancel states, and a dismiss/return path that preserves the user's work.
- [ ] Implement `getHelpContext()` and `searchHelp(query)` using minimal state and bundled reviewed content; start without a vector database or external web search.
- [ ] Wire `navigateTo(destination)` and `highlightControl(controlID)` to the frontend router and stable control identifiers through a typed bridge. Validate allowlisted targets and current availability; return actual success/failure and move accessibility focus appropriately.
- [ ] Implement `requestCameraHelp()` using existing native permission and Settings flows. Explain denial/restriction/model-unavailable states without bypassing permission prompts or inventing recognition results.
- [ ] Add AFM with `SystemLanguageModel`, `LanguageModelSession`, `@Generable`, and `Tool`; use availability guards and runtime readiness checks while preserving iOS 17 compatibility. Keep sessions/context bounded and serialize state-changing actions.
- [ ] Reject arbitrary JavaScript, URLs, unknown action identifiers, and stale/unavailable targets. Treat user/content input as untrusted; enforce action policy in app code, not just model instructions. Capture, speech, uploads, and settings changes require explicit user action.
- [ ] Keep help local by default; exclude media, landmarks, transcript, and audio from model context. Do not retain conversations or log request/response bodies by default.
- [ ] For an approved cloud extension, use an authenticated HTTPS backend with server-side credentials, bounded requests/tool calls, timeouts, rate/spend limits, cancellation, and explicit errors. Obtain separate cloud-help consent, disclose provider/data/retention, and provide opt-out without uploading prior local history.
- [ ] Test both help providers against the same content/action contract where enabled; document SDK/device requirements, unavailable-model behavior, measurements, configuration, and cloud teardown where applicable.

**Tooling choices:** Use Swift Foundation Models and the existing `WKWebView` bridge for the first agent slice. For approved AWS cloud help, prefer API Gateway/Lambda plus Amazon Bedrock tool calling; OpenAI Responses API is an alternative behind the same backend contract. AgentCore/Strands or Microsoft Foundry Agent Service are later options if managed orchestration is justified, not sprint requirements. Use XCTest for native policy/availability tests and the frontend's existing test runner plus browser tests for routing, highlighting, and focus. Apple Private Cloud Compute is a later entitlement-gated iOS/iPadOS 27+ option, not the fallback for iOS 17 or ineligible hardware.

**Acceptance criteria**

- [ ] **Compatibility/fallback:** The app builds with iOS 17 as its minimum. On an eligible device with AFM ready, help uses AFM; on iOS 17, ineligible hardware, or an unavailable model, conventional help remains usable with no cloud request. Bundled help and navigation remain usable offline when the frontend is locally available; a remotely hosted frontend is not claimed to work offline.
- [ ] **Grounding:** A fixed suite covering all six reviewed topics above returns approved guidance or an explicit limitation/no-answer. Camera denied, tracking-only, recognition-model unavailable, avatar unavailable, and cloud-unconfigured fixtures never produce claims that those features are working.
- [ ] **Navigation:** Every registered destination/control passes an end-to-end navigation/highlight test on an implemented screen. Unknown, stale, unavailable, and injected targets are rejected visibly without arbitrary code execution or unintended navigation; no unavailable screen is fabricated.
- [ ] **User control:** Requests to start capture, speak, upload, or change settings cannot execute without explicit user action. Permission denial/revocation and cancellation preserve existing native safeguards, the editable transcript, and immediate stop controls.
- [ ] **Privacy/cloud separation:** Network inspection confirms no help-provider requests in local-help mode and no camera frames, landmarks, transcript, or audio in any help payload. If cloud help is enabled, tests prove separate consent, authenticated access, opt-out/cancellation, visible timeout/quota/service errors, and no silent provider switch or automatic local-history upload.
- [ ] **Accessibility:** Help, suggested actions, error states, destination focus, and return/dismiss controls pass on-device VoiceOver and enlarged-text checks; guidance never relies on color, motion, or speech alone.
- [ ] **Performance/handoff:** Record device/OS/provider, first-response and completed-action latency, and camera responsiveness with/without help using fixed prompts. Set numeric pass/fail budgets before testing; include measured results and only ship the agent slice if those budgets pass. Document untested coverage and cloud blockers without presenting mocks as integrated behavior.

### [P17 · #20](https://github.com/argus1/SignifyGesture/issues/20) — Offline operation

**Track:** iOS / offline reliability · **Suggested owner:** Senior developer + Cross-functional A · **Can start:** Day 1

**Goal:** Launch the Signify app without a development server or network dependency while preserving native camera/Vision and the existing JavaScript bridge. First prefer bundled web assets in the current Swift/WKWebView app; consider Capacitor only if a short proof of concept demonstrates a meaningful advantage without disrupting bridge behavior or XcodeGen. Offline UI/capture is not the same as offline sign recognition: no compatible Core ML model or validated confidence threshold is currently available.

**Dependencies:** P04 for the native shell and bridge; P08 for local recognition/model readiness; P10 for local/cloud mode behavior; P14 for clean-install demo verification. Do not make Capacitor adoption, AWS provisioning, or cloud inference a prerequisite for the offline UI slice.

**Day 1 — Prove build and preserve the dev path**

- [ ] Determine whether the production TanStack Start/Nitro build can run as local static assets without a server; test route navigation and list server-only/runtime blockers.
- [ ] Define a release-only local asset-loading path while retaining `SIGNIFY_FRONTEND_URL` and LAN reloads for development.
- [ ] Confirm scope and dependencies with P04, P08, P10, and P14; record a Capacitor go/no-go decision based on evidence, not the general web-wrapper recommendation.

**Day 2 — Package the smallest offline slice**

- [ ] Bundle a proven frontend build in the existing iOS app and load it locally in WKWebView; do not replace the shell or bridge unless the spike shows this is necessary.
- [ ] Bundle offline-required assets, including fonts, or provide a tested system-font fallback for externally hosted fonts.
- [ ] Define local session behavior and truthful offline states; do not present the AWS sync stub as durable storage. Defer persistence until retention and deletion behavior are agreed.

**Day 3 — Integrate and fault-test**

- [ ] Verify `NativeASLBridge`, camera start/stop, speech, routes, and error/retry behavior against the packaged frontend.
- [ ] Verify that the app launches and navigates with networking disabled and that optional cloud features show an explicit unavailable/retry state without silent fallback.
- [ ] Coordinate with P08: claim offline recognition only after a compatible licensed model and validated confidence policy are bundled and tested; otherwise keep recognition unavailable/no-result and document the limitation.

**Day 4 — Rehearse and hand off**

- [ ] Install a clean build on a supported simulator/device, enable airplane mode before launch, and test launch, primary routes, relaunch, native bridge, camera lifecycle, and local state behavior.
- [ ] Retest the LAN development workflow and document separate dev/release setup, device/OS coverage, known limitations, and fallback instructions.
- [ ] If static bundling is blocked, retain the working LAN path, record the exact blocker and next experiment, and defer framework migration rather than jeopardizing the demo.

**Acceptance criteria**

- [ ] A clean install opens bundled app assets in airplane mode without contacting a development or production web server; primary routes and native bridge actions work.
- [ ] Offline/local state and cloud-unavailable behavior are explicit and truthful; the AWS stub is not treated as durable persistence, and optional cloud requests do not silently substitute results.
- [ ] The existing LAN-hosted development workflow still works independently of the bundled release path.
- [ ] Offline sign recognition is claimed only if a compatible bundled model, validated confidence policy, and offline fixture/live-device test pass. If model/device access is unavailable, record it as an open acceptance blocker and describe the actual offline scope accurately.
- [ ] The final handoff documents the selected approach, commands, platform coverage, remaining blockers, and Capacitor decision.

## References

- [FIG AI Design Makeathon 2026](https://events.figstudio.vc/e/fig-ai-design-makeathon-2026) — event page lists November 7–11, 2026, and the November 14 winner announcement.
- [Lovable documentation: Welcome](https://docs.lovable.dev/introduction/welcome) — use Lovable as a full-stack AI design/build aid for the clickable web prototype; the 100 credits/member allowance is from the hackathon rules provided to the team.
- [Apple Human Interface Guidelines: Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility)
- [AWS Lambda documentation](https://docs.aws.amazon.com/lambda/latest/dg/welcome.html)
- [Apple Foundation Models](https://developer.apple.com/documentation/foundationmodels) — on-device sessions, guided generation, tool calling, and availability checks.
- [Apple Private Cloud Compute integration](https://developer.apple.com/documentation/foundationmodels/adding-server-side-intelligence-with-private-cloud-compute) — later OS, entitlement, availability, and quota requirements.
- [Amazon Bedrock tool use](https://docs.aws.amazon.com/bedrock/latest/userguide/tool-use.html) and [OpenAI function calling](https://developers.openai.com/api/docs/guides/function-calling) — alternative cloud backends for bounded help tools.
- Repository brief: [`ASL_translation_backend.md`](./ASL_translation_backend.md). Its sample pipeline informs the camera → Vision → inference → text/speech design; model readiness and coordinate assumptions must be validated rather than assumed.
- Repository regulatory references: [`Standards/`](../Standards/), including ADA.gov effective-communication guidance, 47 CFR Parts 9 and 64, the TRS working-group report, and the HHS TRS/HIPAA FAQ.
