import SwiftUI

struct SignTranscriptionModelMenu: View {
    var body: some View {
        Menu {
            Text("Production models are not yet available")
            Button("Signify CoreML", action: {})
                .disabled(true)
            Button("Hand Gesture LTSMmp", action: {})
                .disabled(true)
        } label: {
            Image(systemName: "sparkles")
                .font(.title2)
                .foregroundStyle(.black)
                .frame(width: 48, height: 48)
                .background(Color(red: 0.49, green: 0.94, blue: 0.75), in: Circle())
                .overlay(Circle().stroke(.black, lineWidth: 1))
        }
        .accessibilityLabel("Sign transcription models")
        .accessibilityHint("Shows model choices. Production models are not yet available.")
        .accessibilityIdentifier("signTranscriptionModelMenu")
    }
}
