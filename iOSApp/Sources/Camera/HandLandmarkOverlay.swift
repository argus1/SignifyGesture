import SwiftUI
import UIKit

struct LandmarkPreviewSnapshot {
    let frame: LandmarkFrame
    let imageSize: CGSize
    let captureRotation: CGFloat
    var receivedAt = ProcessInfo.processInfo.systemUptime
}

enum HandLandmarkGeometry {
    static let bones = [
        (0, 1), (1, 2), (2, 3), (3, 4),
        (0, 5), (5, 6), (6, 7), (7, 8),
        (0, 9), (9, 10), (10, 11), (11, 12),
        (0, 13), (13, 14), (14, 15), (15, 16),
        (0, 17), (17, 18), (18, 19), (19, 20)
    ]

    static func point(
        _ point: CGPoint,
        imageSize: CGSize,
        previewSize: CGSize,
        rotation: CGFloat,
        mirrored: Bool
    ) -> CGPoint {
        let radians = rotation * .pi / 180
        let cosine = cos(radians)
        let sine = sin(radians)
        let rotatedSize = CGSize(
            width: abs(imageSize.width * cosine) + abs(imageSize.height * sine),
            height: abs(imageSize.width * sine) + abs(imageSize.height * cosine)
        )
        let scale = max(previewSize.width / rotatedSize.width, previewSize.height / rotatedSize.height)
        let x = (point.x - 0.5) * imageSize.width
        let y = (point.y - 0.5) * imageSize.height
        let rotatedX = x * cosine - y * sine
        let rotatedY = x * sine + y * cosine
        return CGPoint(
            x: previewSize.width / 2 + (mirrored ? -rotatedX : rotatedX) * scale,
            y: previewSize.height / 2 + rotatedY * scale
        )
    }
}

struct HandLandmarkOverlay: View {
    let snapshot: LandmarkPreviewSnapshot?
    let previewRotation: CGFloat
    let mirrored: Bool

    var body: some View {
        Canvas { context, size in
            guard let snapshot,
                  ProcessInfo.processInfo.systemUptime - snapshot.receivedAt < 0.5 else { return }
            for hand in 0..<LandmarkFrame.handCount {
                let color: Color = hand == LandmarkHandSide.left.rawValue ? .blue : .orange
                func point(_ joint: Int) -> CGPoint? {
                    let offset = (hand * LandmarkFrame.jointCount + joint) * 3
                    guard snapshot.frame.values[offset + 2] > 0 else { return nil }
                    return HandLandmarkGeometry.point(
                        CGPoint(x: CGFloat(snapshot.frame.values[offset]), y: CGFloat(snapshot.frame.values[offset + 1])),
                        imageSize: snapshot.imageSize,
                        previewSize: size,
                        rotation: previewRotation - snapshot.captureRotation,
                        mirrored: mirrored
                    )
                }
                for (start, end) in HandLandmarkGeometry.bones {
                    guard let startPoint = point(start), let endPoint = point(end) else { continue }
                    var path = Path()
                    path.move(to: startPoint)
                    path.addLine(to: endPoint)
                    context.stroke(path, with: .color(color.opacity(0.8)), lineWidth: 2)
                }
                for joint in 0..<LandmarkFrame.jointCount {
                    guard let position = point(joint) else { continue }
                    context.fill(
                        Path(ellipseIn: CGRect(x: position.x - 3, y: position.y - 3, width: 6, height: 6)),
                        with: .color(color)
                    )
                }
            }
        }
        .clipped()
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }
}
