Yes, MVVM (Model-View-ViewModel) is well-suited for a native iOS ASL translation app, provided you keep the heavy video and Core ML processing in dedicated background services.

## Conversation memory implementation

The shared `src/lib/signify-store.tsx` context owns the live conversation,
durable UUID identities, finalized save snapshots, and one typed `MemoryClient`.
`src/types/memory.ts` defines the versioned bridge request/result contract.
Recap explicitly saves reviewed text through the native bridge; Memory lists,
opens, changes recall consent, and deletes persisted records. Browser and
simulator previews never claim native persistence.

Swift's `ConversationMemory` owns a GRDB `DatabaseQueue` with versioned SQLite
migrations, conversation/turn records, cascading foreign keys, and a
trigger-maintained FTS5 index. Each committed mutation increments a persisted
generation; old-generation requests fail instead of restoring deleted data.
The native bridge serializes operations off the UI thread and restricts memory
access/results to the configured frontend origin/main frame. Errors are
acknowledged without logging transcript contents.

Help's explicit `MemoryRecall` tool uses this same store's bounded lexical
retrieval, gated by global and per-conversation consent. Results retain speaker,
timestamp, and source IDs; another speaker's text is not a user preference.
Personal transcripts are not added to the general `HelpContext`. This is a
storage/retrieval foundation, **not yet model-backed RAG sentence completion**.
Provider integration, composer suggestions, grounding/output validation, and
device evaluation remain open in Issue #17. See the [native runbook](NATIVE_IOS_RUNBOOK.md#local-conversation-memory-issue-17-first-increment)
for the schema contract, limits, privacy/deletion behavior, and verification.

Because SwiftUI relies on declarative state changes, MVVM gives you a clean way to display transcribed words and hand-tracking status without letting camera loops freeze your interface. However, pushing 30 to 60 camera frames per second directly through a @Published property on the main thread will cause UI stutter and high battery drain.

🏗️ Recommended MVVM Architecture for ASL Pipelines

To get the benefits of MVVM without performance bottlenecks, separate your high-frequency data processing from your UI state updates:

* **Model / Services (Background Layer):** Create standalone Swift classes or actors for CameraService (AVFoundation), VisionService (hand landmark extraction), CoreMLService (inference), and SpeechService (AVSpeechSynthesizer). These run strictly on background queues (DispatchQueue or Swift Concurrency) and handle the high-speed frame-by-frame math.  
* **ViewModel (Bridge & Throttling Layer):** Your ASLTranslationViewModel (marked with @MainActor or @Observable) subscribes to the background services. Instead of listening to every single camera frame, it only updates @Published properties when a meaningful state changes—such as a new word being recognized with high confidence, hands entering/leaving the frame, or speech starting/stopping.  
* **View (SwiftUI Layer):** Your SwiftUI views stay lightweight and declarative. They simply render the AVCaptureVideoPreviewLayer, display the transcribedText string, and provide buttons to clear text or toggle audio output.

⚠️ Common MVVM Pitfalls to Avoid Here

* **Publishing Raw Landmarks to the View:** Avoid putting an array of 21 hand coordinates into an @ObservedObject unless you are actively drawing a live skeleton overlay on screen. Updating SwiftUI state 30 times a second for invisible data wastes CPU cycles.  
* **Mixing Camera Setup with View Logic:** Never initialize AVCaptureSession inside a SwiftUI View struct. Keep session lifecycle methods (startSession(), stopSession()) inside your service layer and trigger them via clean ViewModel methods like onAppear() and onDisappear().  
* **Unthrottled TTS Triggers:** If your Core ML model predicts "Hello" across 15 consecutive frames, a naive MVVM binding might trigger AVSpeechSynthesizer 15 times. Add a cooldown timer or state-debouncing check inside your ViewModel or SpeechService so each recognized sign is spoken only once.

💡 Summary Trade-Off

If your app is a **single-screen prototype**, standard MVVM is more than enough and keeps your code organized as you grow. If you later expand into **real-time AR skeleton drawing, multi-screen history logs, and custom model switching**, pairing MVVM with **Swift Concurrency (AsyncStream)** will keep the data flow between your Vision pipeline and SwiftUI views predictable and thread-safe.
