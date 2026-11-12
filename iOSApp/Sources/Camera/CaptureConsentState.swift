import Combine
import Foundation

final class CaptureConsentState: ObservableObject {
    @Published private(set) var isGranted = false
    @Published private(set) var errorMessage: String?
    var onWithdraw: (() throws -> Void)?
    var onChange: ((Bool) -> Void)?

    func setConsent(_ granted: Bool) {
        guard !granted || errorMessage == nil else {
            errorMessage = "Local data cleanup must succeed before capture consent can be enabled again. Retry withdrawing consent."
            return
        }
        isGranted = granted
        onChange?(granted)
        if !granted {
            do {
                try onWithdraw?()
                errorMessage = nil
            } catch {
                errorMessage = "Consent is off, but local data could not be fully deleted: \(error.localizedDescription)"
            }
        }
    }
}
