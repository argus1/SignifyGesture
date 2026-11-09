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

## Physical-device build

1. Connect the iPad, open the generated project in Xcode, and select the device.
2. Set the development team for the `SignifyGesture` target in Xcode signing
   settings. Do not commit machine- or team-specific signing settings.
3. Serve the frontend on the Mac's LAN interface and pass its reachable URL as
   `SIGNIFY_FRONTEND_URL` when building. Do not use `localhost` for a physical
   iPad; use the Mac's current LAN address and keep it out of tracked files.
4. Build and launch from Xcode, grant camera access, and confirm the native
   preview and tracking status. Camera frames remain on device.

For example, replace the placeholder with the current Mac LAN address:

```sh
xcodebuild \
  -project iOSApp/SignifyGesture.xcodeproj \
  -scheme SignifyGesture \
  -destination 'platform=iOS,id=<device-identifier>' \
  SIGNIFY_FRONTEND_URL=http://<mac-lan-address>:5173 \
  build
```

Use the ignored `Docs/NATIVE_IOS_DEVICE_RUNBOOK.local.md` for local device
identifiers. The team-facing runbook must not contain device IDs, LAN addresses,
provisioning profiles, or signing credentials.

## Current capability boundary

The native shell provides AVFoundation capture, Vision hand-pose landmarks,
native speech, and a WKWebView bridge. It does not include a compatible trained
Core ML model, a validated confidence threshold, an AWS integration, or a VRM
renderer. Until those are verified, recognition must remain a no-result state;
do not report tracking landmarks as recognized signs.
