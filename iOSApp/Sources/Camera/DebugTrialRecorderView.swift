#if DEBUG
import Combine
import SwiftUI
import UIKit

struct DebugTrialRecorderView: View {
    @ObservedObject var recorder: DebugTrialRecorder
    @ObservedObject var authService: CognitoAuthService
    @ObservedObject var captureConsent: CaptureConsentState
    let cameraActive: Bool
    @Environment(\.dismiss) private var dismiss
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.verticalSizeClass) private var verticalSizeClass
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @State private var signerID = "S01"
    @State private var split = "train"
    @State private var gloss = DebugTrialRecorder.glosses[0]
    @State private var showsPrivacyAndAccount = false
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
                    .frame(maxWidth: 720, maxHeight: .infinity)
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
        .sheet(isPresented: $showsPrivacyAndAccount) {
            PrivacyAndAccountView(consent: captureConsent, authService: authService, recorder: recorder)
        }
        .onChange(of: signerID) { _, _ in captureConsent.setConsent(false) }
        .onChange(of: scenePhase) { _, phase in
            if phase != .active { recorder.interrupt("App interrupted. Trial discarded; please retry.") }
        }
        .onReceive(timer) { _ in perform { try recorder.expireIfNeeded() } }
    }

    private var canStart: Bool {
        captureConsent.isGranted && cameraActive && recorder.pendingTrial == nil && recorder.exportURL == nil
    }

    private func startTrial() {
        perform {
            try recorder.start(signerID: signerID, split: split, gloss: gloss,
                               consent: captureConsent.isGranted, cameraActive: cameraActive)
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
                    Section {
                        Button("Privacy & account") { showsPrivacyAndAccount = true }
                            .accessibilityIdentifier("trialPrivacyAccountButton")
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
                        }
                    }
                    Section("Accepted trials") {
                        ForEach(recorder.trials) { trial in
                            Text("\(trial.signerID) · \(trial.split) · \(trial.gloss) · \(trial.frames.count) frames")
                        }
                        Text("To remove an accepted participant's data, delete this session and its exported copies. No upload or AWS connection is implemented.")
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
                Group {
                    if recorder.pendingTrial != nil {
                        HStack {
                            Button("Discard trial", role: .destructive) { recorder.discardPending() }
                            Button("Accept trial") { perform { try recorder.accept() } }
                                .disabled(!captureConsent.isGranted)
                        }
                    } else if recorder.isRecording {
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
            .transparentNavigationContainer()
            .navigationTitle("Debug trial capture")
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Delete local session and close") {
                        captureConsent.setConsent(false)
                        if let error = captureConsent.errorMessage {
                            recorder.errorMessage = error
                        } else {
                            dismiss()
                        }
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
