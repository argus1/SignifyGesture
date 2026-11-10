# Native iOS Runbook

## Source of truth

`iOSApp/project.yml` is the source of truth for the native target. The generated
`iOSApp/SignifyGesture.xcodeproj` is ignored and can be recreated with:

```sh
xcodegen generate --spec iOSApp/project.yml
```

Do not edit the generated project file directly.

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
