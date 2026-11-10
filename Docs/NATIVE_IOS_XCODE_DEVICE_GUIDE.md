# Build and test SignifyGesture on an iOS device with Xcode

This guide walks through running the SignifyGesture iOS app on a real iPhone or
iPad. It assumes you are new to Xcode and iOS device testing.

The iOS app is a native shell that loads the web interface from a development
server running on your Mac. Keep the Mac and iOS device on the same Wi-Fi
network while testing.

## What you need

- A Mac with Xcode installed and opened at least once. The project requires the
  iOS 17 SDK or newer.
- An iPhone or iPad running iOS 17 or newer, plus a USB cable for initial setup.
- Access to the Apple developer account and signing team configured for this
  project.
- Bun and XcodeGen installed on the Mac.

## 1. Prepare the Mac

1. Install Xcode from the Mac App Store, then open it once and allow it to
   install any additional components it requests.
2. Open Terminal. You can find it with Spotlight (`Command-Space`, then type
   `Terminal`).
3. If you already use Homebrew, install the required tools:

   ```sh
   brew install bun xcodegen
   ```

   If Homebrew is not installed, install it from
   [brew.sh](https://brew.sh/), or install Bun and XcodeGen using their official
   installation instructions.
4. Confirm the tools are available:

   ```sh
   xcodebuild -version
   bun --version
   xcodegen --version
   ```

## 2. Get the project ready

1. Open Terminal and change to the folder containing the project. For example:

   ```sh
   cd ~/dev/SignifyGesture
   ```

   Use the actual folder where you saved the repository if it is somewhere
   else. The folder should contain `package.json` and `iOSApp/project.yml`.
2. Install the web app dependencies:

   ```sh
   bun install
   ```

3. Generate the Xcode project from its configuration:

   ```sh
   xcodegen generate --spec iOSApp/project.yml
   ```

   `iOSApp/project.yml` is the project configuration source of truth. If the
   generated Xcode project is missing or out of date, run this command again.
4. Open the generated project in Xcode:

   ```sh
   open iOSApp/SignifyGesture.xcodeproj
   ```

   In Xcode's project navigator (the file list on the left), select the blue
   project icon and check that the `SignifyGesture` app target is present.

## 3. Start the web interface

The iOS shell loads the web interface from your Mac, so start its development
server before launching the iOS app.

1. In Terminal, from the project folder, start the server:

   ```sh
   bun run dev -- --host 0.0.0.0 --port 5173
   ```

2. Leave this Terminal window open while you test. The server is running when
   Terminal reports that Vite is ready. If you stop the server, the app cannot
   load its web interface.
3. Find your Mac's Wi-Fi IP address. One way is to open **System Settings >
   Wi-Fi > Details** for the connected network and look under **TCP/IP**.
   Alternatively, in another Terminal window run:

   ```sh
   ipconfig getifaddr en0
   ```

   The result will look like `192.168.1.23`. The exact address will be different
   on your network and may change later.
4. Check that the iPhone or iPad is connected to the same Wi-Fi network. Do not
   use `localhost` as the web address on the device: on an iPhone or iPad,
   `localhost` refers to that device, not your Mac.

## 4. Connect and prepare the device

1. Connect the unlocked iPhone or iPad to the Mac using a USB cable.
2. If the device asks whether to trust this computer, tap **Trust** and enter
   the device passcode. If the Mac asks whether to allow the accessory, allow
   it.
3. If iOS asks to enable Developer Mode, open **Settings > Privacy & Security >
   Developer Mode**, turn it on, restart the device, and confirm the prompt
   after restart.
4. In Xcode, open **Xcode > Settings > Accounts** and sign in with the Apple
   developer account that has access to the project's configured development
   team. Xcode needs this account to sign and install the app.

## 5. Set the web address for the device

The project defaults to `http://localhost:5173`, which works in the iOS
simulator but not on a physical device. Set the app's `SIGNIFY_FRONTEND_URL` to
your Mac's Wi-Fi IP address.

1. In Xcode's project navigator, select the blue **SignifyGesture** project
   icon.
2. Select the **SignifyGesture** app target (not `SignifyGestureTests`).
3. Open **Build Settings** and select **All** rather than **Basic**.
4. Search for `SIGNIFY_FRONTEND_URL`.
5. In the **Debug** configuration, set its value to
   `http://<your-mac-ip>:5173`, replacing the placeholder with your actual IP.
   For example: `http://192.168.1.23:5173`.

This setting is in the generated Xcode project and is ignored by Git. It is
local to your checkout and may need to be set again if you regenerate the
project with XcodeGen. Do not commit your local IP address.

## 6. Select the device and configure signing

1. In Xcode's top toolbar, click the run destination next to the
   `SignifyGesture` scheme and select your connected iPhone or iPad. If it is
   not listed, unlock it, reconnect the cable, and wait for Xcode to finish
   preparing it.
2. In the project settings, select the **SignifyGesture** app target and open
   **Signing & Capabilities**.
3. Make sure **Automatically manage signing** is selected and the configured
   development team is available. If Xcode reports a signing error, confirm
   that you are signed into the correct Apple developer account and that this
   account can use the project's team. Do not change the app's bundle
   identifier to work around a team-access problem without coordinating with
   the project maintainer.

## 7. Build, install, and launch the app

1. Confirm that the web server from step 3 is still running and that the device
   can connect to the Mac's Wi-Fi network.
2. In Xcode, choose **Product > Run**, or press `Command-R`.
3. Xcode builds the app, installs it on the selected device, and opens it. The
   first build may take a few minutes.
4. If iOS says the developer app is not trusted, follow the on-screen
   instructions in **Settings > General > VPN & Device Management** to trust
   the development signing identity, then launch the app again.
5. If the app says it cannot connect, check that the development server is
   running, the device and Mac are on the same network, and the
   `SIGNIFY_FRONTEND_URL` uses the Mac's current IP. Tap **Retry** in the app
   after correcting the issue.

## 8. Test the app on the device

Use the running app to check these basic physical-device behaviors:

1. Confirm the web interface appears in the app.
2. Navigate to the app's sign/camera screen and start the camera.
3. Read the camera-use explanation, continue to the iOS permission prompt, and
   allow camera access. Confirm that the live camera preview and tracking
   status appear.
4. Stop the camera, then start it again. Confirm the preview stops and
   restarts.
5. Switch away from the camera screen or put the app in the background.
   Confirm camera capture stops; return to the app and start it again from the
   screen's **Start camera** control.
6. To test denial and recovery, use **Settings > Privacy & Security >
   Camera** to turn off SignifyGesture's camera access, return to the app, and
   confirm it explains that permission is off and offers a route to Settings.
   Turn permission back on to continue testing.

You can also run the native unit tests from Xcode:

1. Select the `SignifyGesture` scheme and your connected device in the top
   toolbar.
2. Open the Test navigator by choosing **View > Navigators > Test**, or press
   `Command-6`.
3. Click the diamond-shaped test button next to `SignifyGestureTests`, or choose
   **Product > Test** / press `Command-U` to run the scheme's tests.
4. Wait for Xcode to finish. A green check means the test passed; select a red
   failure to read its details in the issue navigator.

Some Xcode or device configurations may require additional signing setup for
on-device tests. If the test target cannot run on the connected device, run
**Product > Test** with an iOS simulator destination instead. Simulator tests
are useful for native bridge regressions, but they do not verify physical
camera behavior.

## If something goes wrong

- **The device is missing from Xcode:** unlock it, reconnect it, accept any
  trust prompts, and wait for Xcode to prepare the device.
- **Signing failed:** check **Xcode > Settings > Accounts** and the app target's
  **Signing & Capabilities** settings. The configured development team must be
  available to the signed-in account.
- **The app opens to a connection error:** make sure `bun run dev` is still
  running, use the Mac's current Wi-Fi IP (not `localhost`), and allow local
  network access if iOS prompts for it.
- **The camera permission prompt does not appear:** check the app's camera
  permission under **Settings > Privacy & Security > Camera**. If permission
  was previously denied, enable it there.
- **Xcode cannot find the project or scheme:** from the repository root, run
  `xcodegen generate --spec iOSApp/project.yml` again, then reopen
  `iOSApp/SignifyGesture.xcodeproj`.

## Current testing limitation

The native app can display the camera and hand-pose tracking status, but a
validated sign-recognition model is not currently configured. Seeing camera
tracking does not mean the app has recognized a sign. Physical-device testing
is still needed to verify camera permission, orientation, backgrounding, and
stop/restart behavior.
