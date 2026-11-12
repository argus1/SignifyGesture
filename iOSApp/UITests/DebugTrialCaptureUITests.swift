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

    private func runTrialCaptureFlow(label: String) {
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

        let consent = app.switches["Participant understands and consents to this session's capture"]
        scrollTo(consent)
        screenshot("2-trial-form-\(label)")
        consent.switches.firstMatch.tap()
        XCTAssertEqual(consent.value as? String, "1", "Consent toggle did not turn on")

        let start = app.buttons["Start trial"]
        XCTAssertTrue(start.waitForExistence(timeout: 5))
        assertOnScreen(start, in: window)
        XCTAssertTrue(start.isEnabled, "Start trial should be enabled with consent and mock camera")
        start.tap()

        let stop = app.buttons["Stop and review"]
        XCTAssertTrue(stop.waitForExistence(timeout: 5))
        assertOnScreen(stop, in: window)
        // The recording panel must leave most of the screen for the camera preview.
        sleep(3)
        screenshot("3-recording-compact-\(label)")
        let panel = app.otherElements["recordingPanel"]
        XCTAssertTrue(panel.exists)
        XCTAssertLessThan(panel.frame.height, window.frame.height * 0.45,
                          "Recording panel covers too much of the camera preview")
        stop.tap()

        let accept = app.buttons["Accept trial"]
        scrollTo(accept)
        screenshot("4-review-\(label)")
        accept.tap()

        let signIn = app.buttons["Sign in with Cognito"]
        scrollTo(signIn)
        screenshot("5-cognito-\(label)")

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
        XCTAssertTrue(element.isHittable, "Element not hittable", file: file, line: line)
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
