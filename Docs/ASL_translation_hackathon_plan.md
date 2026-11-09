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
- The same app can select local inference or an explicitly enabled AWS endpoint; local mode works offline, while cloud mode sends landmarks only and reports network/service errors visibly.
- The team can demonstrate a small isolated-sign vocabulary, confidence/uncertainty, transcript correction, and user-controlled speech. The tested vocabulary, signer coverage, and measured results are visible in the demo or README.
- Camera/cloud consent, privacy limits, accessibility alternatives, and prototype limitations are explained in the UI and pitch.
- No captured video, landmarks, transcript, or audio is retained by default. Demo/testing uses synthetic content or consented data only.
- Accessibility and performance observations, known failures, and next steps are documented; do not present unmeasured accuracy or compliance claims.

## Four-day execution outline

### Day 1 — Align, scope, and unblock

- [x] Use this five-gloss ASL Citizen100 demo vocabulary: `RESEARCH1`, `DEVELOP1`, `CLOUD1`, `EDIT1`, and `DECIDE1`. These frequent labels connect to the judges’ AI/research, engineering, cloud, design, and product-strategy backgrounds; describe them as isolated glosses, not sentences or translation.
- [x] Set the demo audience as makeathon judges unfamiliar with ASL and scope the demo to one isolated gloss at a time. Out of scope: continuous signing or sentence translation, fingerspelling, facial/non-manual markers, signs outside the five-label vocabulary, and emergency, medical, or other high-stakes communication.
- [ ] Designer + cross-functional B map the primary flow, alternatives to camera/speech, error states, and a first low-fidelity wireframe.
- [ ] Senior developer creates the native project shell and defines a stable `LandmarkFrame` / `InferenceProvider` boundary.
- [ ] Cross-functional A spikes the supported iPhone camera/Vision hand-pose path; separately verify Core ML model/data availability.
- [ ] Cross-functional B sketches the AWS request/response contract and confirms account, region, access, and spend availability before provisioning anything.
- [x] Define a signer-independent test protocol using the official ASL Citizen train/validation/test splits, with at least 3 signers and 5 trials per gloss where licensing permits; otherwise use separately consented signer-created samples and record split deviations. Report per-gloss outcomes, confusion/no-result rates, confidence behavior, and on-device end-to-end latency; do not claim measured performance before running the protocol.
- [ ] Start a Lovable credit ledger by member before generating prototypes.

### Day 2 — Build parallel vertical slices

- [ ] Implement camera preview, permission/onboarding, Vision pose extraction, and a visible tracking state.
- [ ] Build a clickable Lovable prototype for flows and interaction review; use it as design evidence, not as the native iOS deliverable.
- [ ] Implement the local inference adapter and evaluation harness against a fixed input shape; if a suitable model is unavailable, clearly label the limited baseline and keep the interface ready for a model.
- [ ] Implement and test the AWS endpoint independently against the same contract; do not upload camera frames.
- [ ] Review wireframes/prototype against VoiceOver, Dynamic Type, contrast, safe areas, and reduced-motion needs.

### Day 3 — Connect the user journey and validate

- [ ] Connect recognition to an editable transcript, explicit speak/replay controls, and a stop/mute control.
- [ ] Add local/AWS selection, cloud opt-in, endpoint/service status, timeouts, and visible failure/retry behavior.
- [ ] Run the fixed evaluation across the agreed signs and signer samples; capture per-class results, confusion cases, confidence behavior, and measured latency.
- [ ] Conduct short task-based usability/accessibility checks; include Deaf/HoH participants when available and record when they are not.
- [ ] Complete privacy/threat-model and standards-scope review. Fix high-severity issues before adding optional features.
- [ ] Only if the core demo is stable, begin the optional avatar mirroring slice; keep it off the critical path.

### Day 4 — Stabilize, demo, and hand off

- [ ] Rehearse a clean-install end-to-end demo in local mode and, if provisioned, AWS mode; verify offline behavior and failure states.
- [ ] Run the accessibility checklist on device, test the full permission/denial/revocation flow, and check transcript corrections and speech controls.
- [ ] Include avatar mirroring only if it is complete, understandable, and does not displace core reliability or accessibility fixes.
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

## Issue board (15 independent, Kanban-sized work items)

Each issue body is intentionally actionable on its own. Add the available repository labels (`enhancement`, `accessibility`, `help wanted`, or `documentation`) as appropriate; issue numbers/links are added after creation.

### [P01 · #1](https://github.com/argus1/SignifyGesture/issues/1) — Set demo scope, vocabulary, and evaluation protocol

**Track:** Product / research · **Suggested owner:** Senior developer + designer · **Can start:** Day 1

**Goal:** Bound the prototype to a small isolated-sign vocabulary and define how the team will evaluate it without overstating capability.

**Current scope and vocabulary:** The demo audience is makeathon judges who may not know ASL. Show one isolated gloss at a time using `RESEARCH1` (research), `DEVELOP1` (develop), `CLOUD1` (cloud), `EDIT1` (edit), and `DECIDE1` (decide), selected for likely familiarity with the judges’ AI/research, engineering, cloud, design, and product-strategy work. Out of scope: continuous signing or sentence translation, fingerspelling, facial/non-manual markers, any gloss outside this five-label set, and emergency, medical, or other high-stakes communication. The English words are cue/label meanings, not a claim that the app translates English phrases into ASL or vice versa.

Each selected label appears in the official ASL Citizen train, validation, and test metadata. In the test split, the labels have 14–17 clips apiece and coverage from 10–11 signers, sufficient for a test target of at least 3 signers and 5 trials per gloss. The protocol is to preserve the published signer-independent split, use validation only for model selection and confidence/no-result threshold setting, and report test results separately for every gloss. These are dataset availability counts, not this app’s recognition results or proof of signer-reviewed meanings.

**Data/model decision:** The supplied article evaluates an ASL Citizen100 subset (100 gloss classes, 3,544 videos from 45 signers), but does not name its glosses or report per-gloss results. It describes a multimodal RGB/pose model; its pose baseline uses 67 three-dimensional landmarks per frame, which is not the same input contract as Apple Vision’s 2D hand-pose observations. The paper and the project repository do not provide a confirmed, app-ready Core ML model/checkpoint. Therefore, no sign-recognition model is currently approved for the demo. Unless a compatible model and its license are verified, the honest fallback is tracking/status plus an explicit no-result state—not a mock or guessed sign prediction.

The official [Microsoft Research license](https://www.microsoft.com/en-us/research/project/asl-citizen/dataset-license/) limits use of its materials to non-commercial, non-revenue-generating research and prohibits redistribution of the data or modifications. The five labels/counts inform scope only. Do not download, bundle, upload, publish, or train/distribute on ASL Citizen videos or derived materials for the demo until the team verifies the planned use is permitted. If it is not, use only newly collected, explicitly consented signer samples under a documented protocol. The supplied paper is not Apple research; Apple’s [sign-language annotation research](https://machinelearning.apple.com/research/sign-language-annotations) reports an isolated-sign baseline on ASL Citizen but does not provide a ready-to-use model or a short list of demo glosses.

References: [Alkhoraif’s paper](https://doi.org/10.1016/j.jer.2025.07.006), Microsoft’s [ASL Citizen dataset description](https://www.microsoft.com/en-us/research/project/asl-citizen/dataset-description/), and its [dataset license](https://www.microsoft.com/en-us/research/project/asl-citizen/dataset-license/).

- [x] Record the five selected glosses, an explicit out-of-scope list, and a small set of non-sensitive test cues: one isolated prompt per gloss—“research,” “develop,” “cloud,” “edit,” and “decide.” Do not combine them into phrases for recognition.
- [x] Document dataset provenance, label coverage, published landmark convention, and license restriction. No app-ready compatible model/checkpoint is confirmed; use tracking plus no-result until a compliant model path is verified.
- [x] Define a repeatable signer-independent test split using the official test partition if permitted; otherwise use consented data and document any deviation. The five selected labels have sufficient listed test coverage to exceed 3 signers and 5 trials each.
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

- [ ] Add an Xcode/SwiftUI app target and document supported Xcode/iOS/device assumptions.
- [ ] Define typed normalized landmark/frame, prediction (label + confidence), provider configuration, and error models.
- [ ] Define `InferenceProvider` implementations for local and AWS modes; make local the default and avoid silent fallback.
- [ ] Add a simple app state flow and dependency injection/test seam so UI can be exercised with a mock provider.
- [ ] Document build/run steps and required permission strings; do not add unrelated packages or account features.

**Acceptance:** App builds on a supported simulator/device, mock inference can drive the UI, and both provider choices share a documented input/output contract.

### [P05 · #5](https://github.com/argus1/SignifyGesture/issues/5) — Implement camera permission, preview, and lifecycle

**Track:** iOS / capture · **Suggested owner:** Cross-functional A · **Can start:** Day 1

**Goal:** Capture frames safely and predictably for the Vision processing path.

- [ ] Request camera access only after explaining why it is needed; handle denied/restricted/revoked access with a usable explanation and retry/settings path.
- [ ] Add a front-camera preview with capture start/stop tied to view lifecycle and a visible camera-active indicator.
- [ ] Configure frame delivery off the UI thread, discard stale frames, and expose actionable errors rather than swallowing them.
- [ ] Verify app behavior when entering background, leaving the screen, and stopping/restarting capture.

**Acceptance:** On a supported device, the user can grant/deny/revoke camera access and start/stop preview without a frozen UI or unhandled permission state.

### [P06 · #6](https://github.com/argus1/SignifyGesture/issues/6) — Extract and normalize Vision hand landmarks

**Track:** iOS / perception · **Suggested owner:** Cross-functional A + senior reviewer · **Can start:** Day 1

**Goal:** Convert Vision observations to a stable, documented inference input.

- [ ] Extract the supported hand joints and confidence values for up to two hands; represent missing joints/hands explicitly.
- [ ] Normalize orientation, mirroring, hand ordering, coordinate range, and confidence according to the agreed model contract.
- [ ] Keep frame processing off the main thread and avoid overlapping unbounded inference work.
- [ ] Add debug visualization or a sample-data inspector that does not persist live camera frames by default.
- [ ] Verify coordinate mapping with known poses and document Vision’s 2D image-space limitations.

**Acceptance:** A deterministic landmark sequence can be produced from live capture and fixture input with tested ordering, missing-point, orientation, and confidence behavior.

### [P07 · #7](https://github.com/argus1/SignifyGesture/issues/7) — Create consented fixtures and a repeatable evaluation harness

**Track:** Data / QA · **Suggested owner:** Cross-functional B + designer · **Can start:** Day 1

**Goal:** Make model iteration measurable while limiting collection and storage.

- [ ] Use synthetic/consented samples only; explain purpose, storage, and deletion before recording any teammate or participant.
- [ ] Prefer landmark-only fixtures; do not commit identifiable video or audio to the repository.
- [ ] Separate train/tuning and evaluation by signer where possible; record the actual split and sample counts.
- [ ] Produce a script or test harness that reports per-class results, confusion matrix, confidence/abstention, and latency.
- [ ] Write down data gaps, signer/device/lighting limitations, and whether external Deaf/HoH review occurred.

**Acceptance:** Another teammate can run the documented evaluation on fixtures and reproduce the reported measurements without accessing raw recordings.

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

## References

- [FIG AI Design Makeathon 2026](https://events.figstudio.vc/e/fig-ai-design-makeathon-2026) — event page lists November 7–11, 2026, and the November 14 winner announcement.
- [Lovable documentation: Welcome](https://docs.lovable.dev/introduction/welcome) — use Lovable as a full-stack AI design/build aid for the clickable web prototype; the 100 credits/member allowance is from the hackathon rules provided to the team.
- [Apple Human Interface Guidelines: Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility)
- [AWS Lambda documentation](https://docs.aws.amazon.com/lambda/latest/dg/welcome.html)
- Repository brief: [`ASL_translation_backend.md`](./ASL_translation_backend.md). Its sample pipeline informs the camera → Vision → inference → text/speech design; model readiness and coordinate assumptions must be validated rather than assumed.
- Repository regulatory references: [`Standards/`](../Standards/), including ADA.gov effective-communication guidance, 47 CFR Parts 9 and 64, the TRS working-group report, and the HHS TRS/HIPAA FAQ.
