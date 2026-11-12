import XCTest

/// Simulator-only accessibility check for the Debug menu and trial capture.
/// The app replaces the camera with a mock when launched with `-SignifyMockCamera`.
final class DebugTrialCaptureUITests: XCTestCase {
    private var app: XCUIApplication!

    override func setUp() {
        continueAfterFailure = false
        app = XCUIApplication()
        app.launchArguments = ["-SignifyMockCamera"]
    }

    override func tearDown() {
        XCUIDevice.shared.orientation = .portrait
    }

    func testTrialCaptureReachablePortrait() {
        XCUIDevice.shared.orientation = .portrait
        runTrialCaptureFlow(label: "portrait")
    }

    func testTrialCaptureReachableLandscape() {
        XCUIDevice.shared.orientation = .landscapeLeft
        runTrialCaptureFlow(label: "landscape")
    }

    func testModelMenuPlaceholdersPortrait() {
        XCUIDevice.shared.orientation = .portrait
        runModelMenuFlow()
    }

    func testModelMenuPlaceholdersLandscape() {
        XCUIDevice.shared.orientation = .landscapeLeft
        runModelMenuFlow()
    }

    func testModelMenuClosesWhenCameraIsBackgrounded() {
        app.launch()
        let menu = app.buttons["signTranscriptionModelMenu"]
        XCTAssertTrue(menu.waitForExistence(timeout: 15))
        menu.tap()
        XCTAssertTrue(app.buttons["Signify CoreML"].waitForExistence(timeout: 5))

        XCUIDevice.shared.press(.home)
        app.activate()
        let disappeared = NSPredicate(format: "exists == false")
        expectation(for: disappeared, evaluatedWith: menu)
        waitForExpectations(timeout: 5)
        XCTAssertFalse(app.buttons["Signify CoreML"].exists)
    }

    func testPrivacyScreenWithoutCameraDoesNotOptInAutomatically() {
        app.launchArguments = []
        app.launch()
        let privacy = app.buttons["privacyAccountButton"]
        XCTAssertTrue(privacy.waitForExistence(timeout: 15))
        privacy.tap()
        let consent = app.switches["captureConsentToggle"]
        scrollTo(consent)
        XCTAssertEqual(consent.value as? String, "0")
        let signIn = app.buttons["Sign in with Cognito"]
        scrollTo(signIn)
        XCTAssertTrue(signIn.exists)
        app.buttons["privacyAccountDone"].tap()
        XCTAssertTrue(privacy.waitForExistence(timeout: 5))
        XCTAssertFalse(app.buttons["signTranscriptionModelMenu"].exists)
    }

    private func runModelMenuFlow() {
        app.launch()
        let menu = app.buttons["signTranscriptionModelMenu"]
        XCTAssertTrue(menu.waitForExistence(timeout: 15))
        assertOnScreen(menu, in: app.windows.firstMatch)
        XCTAssertFalse(app.buttons["debugMenu"].exists)
        XCTAssertFalse(app.otherElements["cameraDebugBar"].exists)
        XCTAssertTrue(app.buttons["privacyAccountButton"].isHittable)
        menu.tap()

        let coreML = app.buttons["Signify CoreML"]
        let gesture = app.buttons["Hand Gesture LTSMmp"]
        XCTAssertTrue(coreML.waitForExistence(timeout: 5))
        XCTAssertTrue(gesture.exists)
        XCTAssertFalse(coreML.isEnabled)
        XCTAssertFalse(gesture.isEnabled)

        app.windows.firstMatch.coordinate(withNormalizedOffset: CGVector(dx: 0.1, dy: 0.5)).tap()
        XCUIDevice.shared.press(.home)
        app.activate()
        let disappeared = NSPredicate(format: "exists == false")
        expectation(for: disappeared, evaluatedWith: menu)
        waitForExpectations(timeout: 5)
        XCTAssertFalse(app.otherElements["mockCameraPreview"].exists)
    }

    private func runTrialCaptureFlow(label: String) {
        app.launchArguments.append("-SignifyShowCameraDebugBar")
        app.launch()
        let window = app.windows.firstMatch

        let debugMenu = app.buttons["debugMenu"]
        XCTAssertTrue(debugMenu.waitForExistence(timeout: 15), "Debug menu missing (mock camera not active?)")
        assertOnScreen(debugMenu, in: window)
        screenshot("1-debug-menu-\(label)")

        debugMenu.tap()
        let captureTrials = app.buttons["Capture trials"]
        XCTAssertTrue(captureTrials.waitForExistence(timeout: 5))
        captureTrials.tap()

        let privacy = app.buttons["trialPrivacyAccountButton"]
        XCTAssertTrue(privacy.waitForExistence(timeout: 5))
        privacy.tap()
        let consent = app.switches["captureConsentToggle"]
        scrollTo(consent)
        screenshot("2-trial-form-\(label)")
        consent.switches.firstMatch.tap()
        XCTAssertEqual(consent.value as? String, "1", "Consent toggle did not turn on")
        app.buttons["privacyAccountDone"].tap()

        let start = app.buttons["Start trial"]
        XCTAssertTrue(start.waitForExistence(timeout: 5))
        assertOnScreen(start, in: window)
        XCTAssertTrue(start.isEnabled, "Start trial should be enabled with consent and mock camera")
        start.tap()

        let panel = app.otherElements["recordingPanel"]
        XCTAssertTrue(panel.waitForExistence(timeout: 5))
        XCTAssertLessThan(panel.frame.height, window.frame.height * 0.45,
                          "Recording panel covers too much of the camera preview")
        screenshot("3-recording-compact-\(label)")
        // Accessibility queries can outlast the capture limit on a busy simulator.
        // A bounded attempt may already be ready for review without a manual stop.
        let stop = app.buttons["Stop and review"]
        if stop.exists { stop.tap() }

        let accept = app.buttons["Accept trial"]
        scrollTo(accept)
        assertOnScreen(accept, in: window)
        screenshot("4-review-\(label)")
        accept.tap()

        scrollTo(privacy)
        privacy.tap()
        let signIn = app.buttons["Sign in with Cognito"]
        scrollTo(signIn)
        screenshot("5-cognito-\(label)")
        let withdraw = app.buttons["withdrawCaptureConsent"]
        scrollTo(withdraw)
        withdraw.tap()
        XCTAssertEqual(consent.value as? String, "0")
        app.buttons["privacyAccountDone"].tap()

        let close = app.buttons["Delete local session and close"]
        XCTAssertTrue(close.waitForExistence(timeout: 5))
        assertOnScreen(close, in: window)
        close.tap()
        XCTAssertTrue(debugMenu.waitForExistence(timeout: 5))
    }

    private func scrollTo(_ element: XCUIElement, file: StaticString = #filePath, line: UInt = #line) {
        // Form rows are lazy, so off-screen rows don't exist until scrolled into view.
        let scrollable = app.collectionViews.firstMatch
        var attempts = 0
        while !(element.exists && element.isHittable) && attempts < 24 {
            if attempts < 12 {
                scrollable.swipeUp(velocity: .slow)
            } else {
                scrollable.swipeDown(velocity: .slow)
            }
            attempts += 1
        }
        XCTAssertTrue(element.exists && element.isHittable,
                      "\(element) could not be scrolled on screen", file: file, line: line)
    }

    private func assertOnScreen(_ element: XCUIElement, in window: XCUIElement,
                                file: StaticString = #filePath, line: UInt = #line) {
        XCTAssertTrue(element.isHittable,
                      "Element at \(element.frame) not hittable in window \(window.frame)",
                      file: file, line: line)
        XCTAssertTrue(window.frame.contains(element.frame),
                      "Element \(element.frame) extends outside window \(window.frame)", file: file, line: line)
    }

    private func screenshot(_ name: String) {
        let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
