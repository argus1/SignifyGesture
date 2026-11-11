# Native iOS Runbook

## Source of truth

`iOSApp/project.yml` is the source of truth for the native target. The generated
`iOSApp/SignifyGesture.xcodeproj` is ignored and can be recreated with:

```sh
xcodegen generate --spec iOSApp/project.yml
```

Do not edit the generated project file directly.

## App icon

The native asset catalog is in `iOSApp/Sources/Assets.xcassets`. Its `AppIcon`
contains a 1024-by-1024, opaque PNG with the Signify mark centered on white;
Xcode produces the required iPhone and iPad icon sizes from it. The original
vector mark is also available as the `SignifyMark` image asset. When changing
the artwork, update both assets and keep the app icon square and opaque.

## Debug-only trial capture (local export; no AWS upload)

In a **Debug** build, start the native camera, then choose **Debug → Capture
trials** in the native camera toolbar. Release builds do not include the recorder or its UI.
This capture path uses native Vision landmarks, not browser camera/ML and not
recognizer output, so a missing recognition model does not block collection.

1. Follow the [P07 consent/storage protocol](ASL_translation_hackathon_plan.md#p07-fixture-protocol)
   before capture. Explain the collector, private withdrawal route, purpose,
   partition and deletion deadline. The participant must affirm consent; camera
   permission is not consent to retain training/evaluation samples.
2. Select a pseudonym `S01`–`S99`, partition and one of the five scoped glosses.
   Do not enter names. Use the same signer code consistently across sessions;
   never reuse a code for a different person. Keep identity lookup separate,
   private and out of exports. Changing the signer resets the consent toggle.
3. Choose **Start trial**, sign the whole isolated gloss, then **Stop and review**.
   A trial needs at least 16 frames and is bounded to 10 seconds/120 frames.
   Tracking loss, camera stop or app interruption discards an active trial rather
   than silently retaining an incomplete sign. Very short/empty/invalid inputs
   show an explicit error. Frame count alone does not validate linguistic quality.
4. Review the gloss, signer, partition, duration and frame count. Accept or
   discard before proceeding. The pilot target is **3 signers × 5 trials × 5
   glosses = 75**, with a five-trial cap per signer/gloss and 75 per session.
   Accepted trials remain in memory; app termination loses unexported trials.
   Delete session/withdrawal removes all accepted and pending trials, not just
   the currently selected signer.
5. Explicitly confirm controlled local storage, then **Prepare protected JSON
   export** and **Save JSON using system share sheet**. Select only a controlled
   local destination; the system share sheet may offer cloud services and cannot
   enforce this policy. On a Mac store under ignored
   `local-data/consented-fixtures/`. No automatic upload, S3 integration,
   AWS credentials or inference-provider change is included.
6. **Delete prepared export** allows further captures. **Delete local session and
   close** removes the internal export and in-memory trials. Export/storage errors
   are shown in the sheet. Delete copies saved outside the app yourself, including
   on withdrawal; the app cannot revoke or delete shared copies.

Each JSON export has `schemaVersion: 1`, purpose, coordinate contract,
`handOrder`, `jointOrder`, `channels`, device family/OS and `trials`. Each trial has
a random UUID, pseudonymous `signerID`, split, gloss and variable-length `frames`.
Each frame has `elapsedMs` relative to the first captured frame and `values`
(126 floats: anatomical left/right × 21 joints × x/y/confidence). The joint list
comes directly from the native normalization contract. Coordinates are normalized,
unmirrored, top-left-origin 2D; absent joints are zero. There is no depth,
video/audio, absolute capture timestamp, name, transcript or prediction. The
nominal Vision rate is limited to 12 Hz but actual intervals vary; timestamps
must be increasing. A training pipeline must explicitly resample/window these
variable-length trials for a particular model (the current adapter expects 16
frames). Capture exports are **not** prediction arrays for `evaluate-asl.ts`;
run an approved model first to obtain evaluation records.

The internal prepared file uses iOS complete file protection and backup exclusion.
The open recorder expires its session after 24 hours; expired internal exports
left after termination are removed on the next Debug app launch. iOS does not
guarantee deletion while the app is suspended/terminated. End-of-session manual
deletion and collector-managed deletion of external copies remain mandatory.

The recorder rejects a signer's partition changing within the current session.
Across exports/devices, the collector must maintain a separate partition ledger:
no signer may appear in training **and** validation/test. Three signers and 75
trials are a **pilot**, not evidence of sufficient training data or generalization.
If all three are assigned to training, recruit additional independent signers for
validation/test; do not reuse their trials as held-out results. Landmarks may
still identify people. Hand-only 2D capture omits body/face cues and may be
insufficient to distinguish these glosses.

Simulator tests cover consent, pseudonyms, partition checks, trial review,
limits, interruptions, JSON round-trip, deletion and expiry using synthetic
landmarks. Physical-device capture/export, participant recruitment, sample
quality and model evaluation remain unverified. Future S3 work needs a private
bucket, explicit separate upload consent/retention, authenticated short-lived
upload authorization, deletion support and approved AWS provisioning.

### Cognito sign-in groundwork

Debug capture exposes an optional Cognito User Pool sign-in using the hosted UI,
OAuth authorization code flow and PKCE. It stores access/refresh tokens in the
iOS Keychain and can refresh or revoke a session. The Cognito app client must be
a public/native client with no client secret, authorization code grant enabled,
and `openid` plus `offline_access` scopes. Register
`signifygesture://auth/callback` as an allowed callback URL.

Set `SIGNIFY_COGNITO_HOSTED_UI_DOMAIN` (an HTTPS hosted UI/custom domain) and
`SIGNIFY_COGNITO_APP_CLIENT_ID` in the ignored
`iOSApp/Config/Local.xcconfig`. These are public client settings, not secrets.
Sign-in does not upload data or grant the app direct S3 access. A separately
configured HTTPS backend must validate the Cognito access token, enforce
participant authorization and upload consent, and return short-lived,
object-scoped S3 upload authorization. Do not put IAM credentials or S3 write
credentials in the app. No Cognito resources or upload backend are provisioned
by this change.

## Requirements

- Xcode with the iOS 17 SDK or newer.
- XcodeGen 2.38.0 or newer.
- The app deployment target is iOS 17.0; both iPhone and iPad device families
  are enabled.

## Simulator build

```sh
xcodebuild \
  -project iOSApp/SignifyGesture.xcodeproj \
  -scheme SignifyGesture \
  -configuration Debug \
  -destination 'platform=iOS Simulator,name=iPhone 17' \
  CODE_SIGNING_ALLOWED=NO \
  build
```

The default frontend URL is `http://localhost:5173`, suitable for the local
development setup. Start the Lovable/Vite frontend before launching the app.
The wrapper loads this URL in a `WKWebView`; it does not bundle the React app.
If the URL is unreachable, the app displays a connection error with a Retry
button rather than a blank screen.

## Physical-device build

1. Connect the iPad, open the generated project in Xcode, and select the device.
2. The development team is configured in `iOSApp/project.yml` and is retained
   when XcodeGen regenerates the project. Xcode must still have access to the
   matching Apple developer account, signing certificate, and device
   provisioning profile.
3. Serve the frontend on the Mac's LAN interface and pass its reachable URL as
   `SIGNIFY_FRONTEND_URL` when building. Do not use `localhost` for a physical
   iPad; use the Mac's current LAN address and keep it out of tracked files.
   For **Product > Run**, create the ignored `iOSApp/Config/Local.xcconfig`:

   ```xcconfig
   SIGNIFY_FRONTEND_URL = http:/$()/<mac-lan-address>:5173
   ```

   The `$()` keeps `//` from being parsed as an xcconfig comment.
   `Config/Frontend.xcconfig` includes this optional override for both build
   configurations. Regenerate the project with
   `xcodegen generate --spec iOSApp/project.yml` after updating the project
   specification. The override survives regeneration; update it if the Mac's
   LAN address changes. Remove the override to restore the simulator's
   `localhost` default, or pass `SIGNIFY_FRONTEND_URL` on the build command line.
4. Choose **Product > Run** (not just **Build**) in Xcode. Run builds, installs,
   and launches the app; `xcodebuild ... build` only creates an app bundle.
   Grant camera access and confirm the native
   preview and tracking status. Confirm the app explains camera use before the
   iOS permission prompt, and that denial provides a Settings path. Background
   the app and confirm capture stops; return to the foreground and restart from
   the frontend **Start camera** control. Both the frontend **Stop camera**
   control and the native stop control must stop capture. Switching to Speech
   or leaving a camera screen must also stop capture.
   Camera frames remain on device.

For example, replace the placeholder with the current Mac LAN address:

```sh
xcodebuild \
  -project iOSApp/SignifyGesture.xcodeproj \
  -scheme SignifyGesture \
  -destination 'platform=iOS,id=<device-identifier>' \
  SIGNIFY_FRONTEND_URL=http://<mac-lan-address>:5173 \
  build
```

For a command-line run, add `-derivedDataPath iOSApp/.device-build` to the build
command, then explicitly install and launch:

```sh
xcrun devicectl device install app --device '<device-identifier>' \
  iOSApp/.device-build/Build/Products/Debug-iphoneos/SignifyGesture.app
xcrun devicectl device process launch --device '<device-identifier>' \
  com.argussun.signifygesture
```

Keep the frontend running with `npm run dev -- --host 0.0.0.0 --port 5173`.
The iPad must be able to reach that address; approve local-network access if
prompted. A launch with an unreachable frontend is not a camera verification.

Use the ignored `Docs/NATIVE_IOS_DEVICE_RUNBOOK.local.md` for local device
identifiers. The team-facing runbook must not contain device IDs, LAN addresses,
provisioning profiles, or signing credentials.

## Bridge regression checks

The frontend posts flat commands such as
`{ type: "triggerCameraToggle", active: true }` to `aslBridge`. Swift accepts
that contract and the older `{ method, payload }` envelope. Errors return through
`onNativeError` and appear in the web UI.

```sh
npm test -- src/test/native-bridge.test.ts src/test/camera-lifecycle.test.tsx
xcodegen generate --spec iOSApp/project.yml
xcodebuild test \
  -project iOSApp/SignifyGesture.xcodeproj \
  -scheme SignifyGesture \
  -destination 'platform=iOS Simulator,name=iPhone 17' \
  CODE_SIGNING_ALLOWED=NO
```

The native tests exercise actual WKWebView messages and Swift replies. Simulator
tests do not verify physical camera capture. Keep issue #5's final checkbox open
until an iPad run confirms permission grant/denial/revocation, background stop,
screen/mode exit, and stop/restart without a frozen UI.

## Current capability boundary

The native shell provides AVFoundation capture, Vision hand-pose landmarks,
native speech, and a WKWebView bridge. It does not include a compatible trained
Core ML model, a validated confidence threshold, an AWS integration, or a VRM
renderer. Until those are verified, recognition must remain a no-result state;
do not report tracking landmarks as recognized signs.

## Vision landmark input contract

Each frame is flattened as `[hand][joint][x, y, confidence]` with two hand slots
(anatomical left at index 0, right at index 1) and 21 joints per hand in this
order: wrist; thumb CMC/MP/IP/tip; index MCP/PIP/DIP/tip; middle MCP/PIP/DIP/tip;
ring MCP/PIP/DIP/tip; little MCP/PIP/DIP/tip. Coordinates are normalized to the
captured image bounds in `[0, 1]`, use a top-left origin, and undo horizontal
mirroring when fixture input is marked as mirrored. Live capture is explicitly
unmirrored before Vision determines anatomical handedness; the selfie preview
and inspector drawing are mirrored for display only. Unknown Vision chirality produces a visible error instead
of being assigned to the right-hand slot. Confidence is clamped
to `[0, 1]`; an absent hand or joint is represented by `(0, 0, 0)`. The camera
path uses `AVCaptureDevice.RotationCoordinator` to rotate delivered pixel buffers
upright relative to gravity, including orientation changes, before supplying
`.up` to Vision. Coordinates are relative to that upright image, not the
preview's aspect-fill crop. The inspector flips only its drawing horizontally
to match the selfie preview; model coordinates and anatomical labels are unchanged.

The Debug build's Landmark Inspector draws the latest normalized frame in memory;
it writes no camera or landmark data and clears its snapshot when capture stops.
Synthetic known-coordinate fixtures test the transform and slot ordering.
Physical-device pose-alignment checks supplement these tests: Vision provides
2D image-space points, not depth or a 3D hand pose, and the simulator cannot
verify real camera orientation/mirroring behavior.

The initial portrait-device test reported a 90-degree counterclockwise skeleton
and both single hands assigned to Right. Capture rotation and unmirrored Vision
input were corrected in response. For regression checks, in portrait test each open palm separately (left blue/right
orange), both hands crossing, horizontal/vertical motion, index-finger bending,
and removal of both hands. Repeat in landscape and confirm the skeleton remains
upright and labels follow anatomical hands; report any persistent Vision
misclassification rather than substituting screen-position ordering.

The follow-up device test confirmed correct anatomical hand identification and
an upright skeleton in portrait. A subsequent test confirmed the mirrored
inspector stays upright with correct anatomical labels and movement in landscape,
but the camera preview remained rotated 90 degrees. The preview now has its own
`RotationCoordinator`, observing the preview-specific angle independently of
capture rotation and preserving selfie mirroring. On November 10, 2026, the
tester confirmed the preview works in both landscape and portrait directions,
clearing the final device-verification blocker for issue #6. All 10 native
simulator tests also pass. This evidence covers landmark mapping on the tested
device, not recognition accuracy or all-device compatibility; repeat these
checks when changing camera geometry or targeting another device.
