import SwiftUI
import UIKit

struct PrivacyAndAccountView: View {
    @ObservedObject var consent: CaptureConsentState
    @ObservedObject var authService: CognitoAuthService
    #if DEBUG
    @ObservedObject var recorder: DebugTrialRecorder
    @State private var confirmsExport = false
    #endif
    @Environment(\.dismiss) private var dismiss
    private let mint = Color(red: 0.49, green: 0.94, blue: 0.75)

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Label("YOUR CHOICE", systemImage: "hand.raised")
                        .font(.caption.weight(.bold))
                    Text("Privacy & account")
                        .font(.largeTitle.weight(.heavy))
                    Text("Use the camera without consent or sign-in. Optional local capture consent and your Cognito account are separate choices.")
                }
                Section("Optional local capture") {
                    Text("Consent applies only to this app session's explicit local landmark collection. It does not authorize future data collection or automatic uploads. No participant video or audio is recorded.")
                    Text("Local trials contain hand landmarks, relative timestamps, gloss, signer code and split. Landmarks may identify a person. Explain the collection purpose, collector and private withdrawal route before opting in.")
                    Text("Trials remain in memory until explicit export. Delete local session data and any exported copies at session end, within 24 hours, or immediately on withdrawal. Copies saved outside the app must be deleted by the collector.")
                    Toggle(
                        "Participant understands and consents to this session's capture",
                        isOn: Binding(get: { consent.isGranted }, set: consent.setConsent)
                    )
                    .accessibilityIdentifier("captureConsentToggle")
                    Text(consent.isGranted ? "Local capture consent is on for this session." : "Fun-only mode: no permission to retain or export new participant captures.")
                    Button("Withdraw consent and delete local data", role: .destructive) {
                        consent.setConsent(false)
                    }
                    .accessibilityIdentifier("withdrawCaptureConsent")
                    if let error = consent.errorMessage {
                        Text(error).foregroundStyle(.red)
                            .accessibilityAddTraits(.updatesFrequently)
                    }
                }
                Section("Cognito account") {
                    if authService.isAuthenticated {
                        Label("Signed in with Cognito", systemImage: "checkmark.shield.fill")
                        Button("Sign out of Cognito", role: .destructive) {
                            Task { await authService.signOut() }
                        }
                    } else {
                        Button(authService.isAuthenticating ? "Signing in..." : "Sign in with Cognito") {
                            Task { await authService.signIn() }
                        }
                        .disabled(authService.isAuthenticating || authService.configurationMessage != nil)
                    }
                    if let message = authService.configurationMessage {
                        Text(message)
                    }
                    if let error = authService.errorMessage {
                        Text(error).foregroundStyle(.red)
                            .accessibilityAddTraits(.updatesFrequently)
                    }
                    Text("Signing in does not grant capture consent, upload trials or grant direct S3 access. Tokens stay in the iOS Keychain and are not shared with the web UI. Cloud collection is not configured.")
                }
                #if DEBUG
                Section("Debug pilot collection") {
                    Text("Pilot only: 3 signers x 5 trials x 5 glosses = 75. This is not a validated training dataset. Keep each signer in one split, including across export files; evaluation signers cannot also be training/tuning signers.")
                    Text("Changing signer code withdraws session consent and clears this session's local data. Export consented trials first if they must be retained under the agreed collection policy.")
                }
                Section("Explicit local export (Debug)") {
                    Toggle("I will save only to controlled local storage, not cloud/shared services", isOn: $confirmsExport)
                    if let url = recorder.exportURL {
                        ShareLink("Save JSON using system share sheet", item: url)
                            .disabled(!confirmsExport || !consent.isGranted)
                        Button("Delete prepared export") { perform { try recorder.deleteExport() } }
                    } else {
                        Button("Prepare protected JSON export") {
                            perform {
                                try recorder.export(
                                    deviceModel: UIDevice.current.model,
                                    operatingSystem: UIDevice.current.systemVersion,
                                    directory: FileManager.default.temporaryDirectory
                                )
                            }
                        }
                        .disabled(!confirmsExport || !consent.isGranted || recorder.trials.isEmpty ||
                                  recorder.isRecording || recorder.pendingTrial != nil)
                    }
                    Text("The share sheet may offer cloud destinations: do not select them. External copies cannot be deleted by this app. On the Mac use ignored local-data/consented-fixtures/. Expired internal files are removed at next launch if the app was not running.")
                    if let error = recorder.errorMessage {
                        Text(error).foregroundStyle(.red)
                    }
                }
                #endif
            }
            .scrollContentBackground(.hidden)
            .background(Color.white)
            .foregroundStyle(.black)
            .tint(mint)
            .navigationTitle("Privacy & account")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                        .accessibilityIdentifier("privacyAccountDone")
                }
            }
        }
    }

    #if DEBUG
    private func perform(_ action: () throws -> Void) {
        do {
            try action()
        } catch {
            recorder.errorMessage = error.localizedDescription
        }
    }
    #endif
}
