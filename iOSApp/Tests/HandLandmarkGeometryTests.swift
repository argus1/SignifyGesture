import XCTest
@testable import SignifyGesture

final class HandLandmarkGeometryTests: XCTestCase {
    #if DEBUG && targetEnvironment(simulator)
    func testStoppingCameraClearsLatestPreviewSnapshot() async {
        let camera = CameraCaptureService()
        camera.showMockLandmarks(LandmarkFrame(hands: [], timestamp: 1, sourceIsMirrored: false))
        XCTAssertNotNil(camera.latestPreviewSnapshot)

        let stopped = expectation(description: "Camera stopped and preview cleared")
        camera.stop { stopped.fulfill() }
        await fulfillment(of: [stopped], timeout: 5)
        XCTAssertNil(camera.latestPreviewSnapshot)
    }
    #endif

    func testPortraitSelfieMirrorsHorizontallyWithoutChangingHeight() {
        let point = HandLandmarkGeometry.point(
            CGPoint(x: 0.25, y: 0.75),
            imageSize: CGSize(width: 480, height: 640),
            previewSize: CGSize(width: 240, height: 320),
            rotation: 0,
            mirrored: true
        )
        XCTAssertEqual(point.x, 180, accuracy: 0.001)
        XCTAssertEqual(point.y, 240, accuracy: 0.001)
    }

    func testAspectFillCropsRatherThanStretchingLandmarks() {
        let point = HandLandmarkGeometry.point(
            CGPoint(x: 0.25, y: 0.75),
            imageSize: CGSize(width: 480, height: 640),
            previewSize: CGSize(width: 300, height: 600),
            rotation: 0,
            mirrored: false
        )
        XCTAssertEqual(point.x, 37.5, accuracy: 0.001)
        XCTAssertEqual(point.y, 450, accuracy: 0.001)
    }

    func testPreviewRotationUsesCaptureRelativeAngleBeforeMirroring() {
        let point = HandLandmarkGeometry.point(
            CGPoint(x: 0.25, y: 0.75),
            imageSize: CGSize(width: 480, height: 640),
            previewSize: CGSize(width: 640, height: 480),
            rotation: 90,
            mirrored: true
        )
        XCTAssertEqual(point.x, 480, accuracy: 0.001)
        XCTAssertEqual(point.y, 120, accuracy: 0.001)
    }

    func testNegativeRotationAndOppositeLandscapeOrientation() {
        let point = CGPoint(x: 0.25, y: 0.75)
        let clockwise = HandLandmarkGeometry.point(
            point, imageSize: CGSize(width: 480, height: 640),
            previewSize: CGSize(width: 640, height: 480), rotation: -90, mirrored: false
        )
        XCTAssertEqual(clockwise.x, 480, accuracy: 0.001)
        XCTAssertEqual(clockwise.y, 360, accuracy: 0.001)

        let inverted = HandLandmarkGeometry.point(
            point, imageSize: CGSize(width: 480, height: 640),
            previewSize: CGSize(width: 480, height: 640), rotation: 180, mirrored: false
        )
        XCTAssertEqual(inverted.x, 360, accuracy: 0.001)
        XCTAssertEqual(inverted.y, 160, accuracy: 0.001)
    }
}
