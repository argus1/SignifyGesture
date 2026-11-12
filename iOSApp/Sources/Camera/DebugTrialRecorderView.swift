#if DEBUG
import Combine
import SwiftUI
import UIKit

struct DebugTrialRecorderView: View {
    @ObservedObject var recorder: DebugTrialRecorder
    @ObservedObject var authService: CognitoAuthService
    let cameraActive: Bool
    @Environment(\.dismiss) private var dismiss
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.verticalSizeClass) private var verticalSizeClass
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @State private var signerID = "S01"
    @State private var split = "train"
    @State private var gloss = DebugTrialRecorder.glosses[0]
    @State private var consent = false
    @State private var confirmsExport = false
    @State private var collapsed = false
    private let timer = Timer.publish(every: 1, on: .main, in: .common).autoconnect()

    var body: some View {
        ZStack {
            if collapsed {
                compactControls
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            } else {
                fullForm
                    .glassBackground(in: RoundedRectangle(cornerRadius: 28, style: .continuous))
                    .frame(maxWidth: 720)
                    .padding(.horizontal, horizontalSizeClass == .regular ? 24 : 0)
                    .padding(.vertical, horizontalSizeClass == .regular ? 24 : 0)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .animation(.snappy, value: collapsed)
        // Presented as a transparent full-screen cover so the native camera preview stays visible
        // behind the glass; collapsing to the bottom card leaves the preview mostly unobstructed.
        .presentationBackground(.clear)
        .onAppear { collapsed = recorder.isRecording }
        .onChange(of: recorder.isRecording) { _, recording in
            collapsed = recording
        }
        .onChange(of: signerID) { _, _ in consent = false }
        .onChange(of: consent) { _, allowed in
            if !allowed { recorder.interrupt("Consent removed. Trial discarded; delete the session for withdrawal.") }
        }
        .onChange(of: scenePhase) { _, phase in
            if phase != .active { recorder.interrupt("App interrupted. Trial discarded; please retry.") }
        }
        .onReceive(timer) { _ in perform { try recorder.expireIfNeeded() } }
    }

    private var canStart: Bool {
        consent && cameraActive && recorder.pendingTrial == nil && recorder.exportURL == nil
    }

    private func startTrial() {
        perform {
            try recorder.start(signerID: signerID, split: split, gloss: gloss,
                               consent: consent, cameraActive: cameraActive)
        }
    }

    private var recordingStatus: some View {
        Group {
            if recorder.isRecording {
                Label("Recording", systemImage: "record.circle.fill")
                    .foregroundStyle(.red)
            } else {
                Label("Ready", systemImage: "hand.raised")
            }
        }
        .font(.headline)
    }

    @ViewBuilder
    private var compactButtons: some View {
        if recorder.isRecording {
            Button("Stop and review") { recorder.stop() }
                .buttonStyle(.borderedProminent)
                .tint(.red)
            Button("Show details") { collapsed = false }
                .buttonStyle(.bordered)
        } else {
            Button("Start trial", action: startTrial)
                .buttonStyle(.borderedProminent)
                .disabled(!canStart)
            Button("Show details") { collapsed = false }
                .buttonStyle(.bordered)
        }
    }

    /// Only this bottom card is drawn while recording, so the camera preview stays visible.
    private var compactControls: some View {
        Group {
            if verticalSizeClass == .compact {
                HStack(spacing: 16) {
                    recordingStatus
                    Text("\(signerID) · \(split) · \(gloss) · \(recorder.frameCount) frames")
                        .font(.subheadline)
                        .monospacedDigit()
                        .lineLimit(1)
                    Spacer(minLength: 8)
                    compactButtons
                }
            } else {
                VStack(alignment: .leading, spacing: 10) {
                    HStack {
                        recordingStatus
                        Spacer()
                        Text("\(recorder.frameCount) frames")
                            .monospacedDigit()
                            .foregroundStyle(.secondary)
                    }
                    Text("\(signerID) · \(split) · \(gloss)")
                        .font(.subheadline)
                    HStack { compactButtons }
                        .frame(maxWidth: .infinity)
                    if let error = recorder.errorMessage {
                        Text(error)
                            .font(.footnote)
                            .foregroundStyle(.red)
                            .lineLimit(2)
                    }
                }
            }
        }
        .padding(16)
        .glassBackground(in: RoundedRectangle(cornerRadius: 24, style: .continuous))
        .padding(.horizontal, 12)
        .padding(.bottom, 8)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("recordingPanel")
    }

    private var fullForm: some View {
        NavigationStack {
            Form {
                Group {
                    Section("Consent before capture") {
                        Text("Pilot only: 3 signers × 5 trials × 5 glosses = 75. This is not a validated training dataset. Keep each signer in one split, including across export files; evaluation signers cannot also be training/tuning signers.")
                        Text("Explain the purpose, collector and private withdrawal route first. Only hand landmarks, relative timestamps, gloss, signer code and split are captured; no video/audio. Landmarks may identify a person. Trials stay in memory until explicit export. Close/Delete removes this session's local data. Delete any exported copies at session end, within 24 hours, or immediately on withdrawal.")
                        Toggle("Participant understands and consents to this session's capture", isOn: $consent)
                            .disabled(recorder.isRecording)
                    }
                    Section("Trial") {
                        TextField("Signer code (S01–S99)", text: $signerID)
                            .textInputAutocapitalization(.characters)
                            .autocorrectionDisabled()
                            .disabled(recorder.isRecording || recorder.pendingTrial != nil)
                        Picker("Split", selection: $split) {
                            ForEach(DebugTrialRecorder.splits, id: \.self) { Text($0) }
                        }
                        .disabled(recorder.isRecording || recorder.pendingTrial != nil)
                        Picker("Gloss", selection: $gloss) {
                            ForEach(DebugTrialRecorder.glosses, id: \.self) { Text($0) }
                        }
                        .disabled(recorder.isRecording || recorder.pendingTrial != nil)
                        Text("Use the whole isolated sign, including its start and end. Stop after signing; at most 10 seconds / 120 frames. At least 16 frames required. Tracking loss discards the active trial.")
                        Text("Frames: \(recorder.frameCount). Accepted: \(recorder.trials.count)/75.")
                            .monospacedDigit()
                        Text("This signer/gloss: \(recorder.trials.filter { $0.signerID == signerID && $0.gloss == gloss }.count)/5 accepted.")
                        Text("Start trial is pinned to the bottom of this panel. Starting collapses the panel to a small card so the camera preview stays visible.")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                    if let trial = recorder.pendingTrial {
                        Section("Review captured trial") {
                            Text("\(trial.signerID) · \(trial.split) · \(trial.gloss): \(trial.frames.count) frames, \(Int(trial.frames.last?.elapsedMs ?? 0)) ms.")
                            Text("Verify the gloss was signed correctly and completely. Frame count alone does not establish sign quality.")
                            Button("Accept trial") { perform { try recorder.accept() } }
                            Button("Discard trial", role: .destructive) { recorder.discardPending() }
                        }
                    }
                    Section("Accepted trials") {
                        ForEach(recorder.trials) { trial in
                            Text("\(trial.signerID) · \(trial.split) · \(trial.gloss) · \(trial.frames.count) frames")
                        }
                        Text("To remove an accepted participant's data, delete this session and its exported copies. No upload or AWS connection is implemented.")
                    }
                    Section("S3 authentication (Debug)") {
                        if authService.isAuthenticated {
                            Label("Signed in with Cognito", systemImage: "checkmark.shield.fill")
                            Button("Sign out of Cognito", role: .destructive) {
                                Task { await authService.signOut() }
                            }
                        } else {
                            Button(authService.isAuthenticating ? "Signing in…" : "Sign in with Cognito") {
                                Task { await authService.signIn() }
                            }
                            .disabled(authService.isAuthenticating || authService.configurationMessage != nil)
                        }
                        if let message = authService.configurationMessage {
                            Text(message)
                        }
                        if let error = authService.errorMessage {
                            Text(error).foregroundStyle(.red)
                        }
                        Text("Sign-in only establishes an authenticated identity. This does not upload trials or grant direct S3 access; a backend must verify the access token and issue short-lived, per-upload authorization.")
                    }
                    Section("Explicit local export") {
                        Toggle("I will save only to controlled local storage, not cloud/shared services", isOn: $confirmsExport)
                        if let url = recorder.exportURL {
                            ShareLink("Save JSON using system share sheet", item: url)
                                .disabled(!confirmsExport || !consent)
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
                            .disabled(!confirmsExport || !consent || recorder.trials.isEmpty ||
                                      recorder.isRecording || recorder.pendingTrial != nil)
                        }
                        Text("The share sheet can offer cloud destinations: do not select them. Copies saved outside the app are not deleted by this app; the collector must delete them. On the Mac use ignored local-data/consented-fixtures/. If the app is not running, expired internal files are removed at next launch, not by a background deletion service.")
                        Button("Delete session / withdraw consent", role: .destructive) {
                            perform { try recorder.clear(); consent = false; confirmsExport = false }
                        }
                    }
                    if let error = recorder.errorMessage {
                        Section("Capture / storage error") {
                            Text(error).foregroundStyle(.red).accessibilityAddTraits(.updatesFrequently)
                        }
                    }
                }
                .listRowBackground(Color.clear)
            }
            .scrollContentBackground(.hidden)
            .safeAreaInset(edge: .bottom) {
                if recorder.pendingTrial == nil {
                    Group {
                        if recorder.isRecording {
                            HStack {
                                Button("Stop and review") { recorder.stop() }
                                    .tint(.red)
                                Button("Hide details") { collapsed = true }
                                    .buttonStyle(.bordered)
                            }
                        } else {
                            Button("Start trial", action: startTrial)
                                .disabled(!canStart)
                        }
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.large)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
                    .glassBackground(in: Rectangle())
                }
            }
            .transparentNavigationContainer()
            .navigationTitle("Debug trial capture")
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Delete local session and close") {
                        perform { try recorder.clear(); dismiss() }
                    }
                }
            }
        }
    }

    private func perform(_ action: () throws -> Void) {
        do {
            try action()
        } catch {
            recorder.errorMessage = error.localizedDescription
        }
    }
}
#endif
