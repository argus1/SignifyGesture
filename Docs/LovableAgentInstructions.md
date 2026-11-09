# Project Architecture & Agentic Rules: ASL-to-TTS Frontend Shell

## 1. Core Architectural Boundary
You are building **strictly the frontend UI and state management layer** for an American Sign Language (ASL) transcription and Text-to-Speech (TTS) application. 

This React/Vite application will be embedded inside a native **iOS Swift wrapper (`WKWebView` / Capacitor)** and connected to an **AWS backend**. 

### STRICT EXCLUSIONS (DO NOT IMPLEMENT)
You must **NEVER** write, import, or mock browser-level implementations for any of the following hardware or cloud services:
1. **Camera & Video Feeds:** Do NOT use `navigator.mediaDevices.getUserMedia`, `<video>` webcam streams, or browser canvas frame capture.
2. **ML & Gesture Inference:** Do NOT install or use MediaPipe, TensorFlow.js, ONNX Runtime Web, or any client-side hand-tracking/ASL recognition libraries. (Handled natively via Swift `AVFoundation`, `Vision`, and `Core ML`).
3. **Text-to-Speech (TTS):** Do NOT use the browser `window.speechSynthesis` Web Speech API or client-side audio synthesis. (Handled natively via Swift `AVSpeechSynthesizer` or AWS Polly).
4. **3D VRM Avatar / Signing Mirror:** Do NOT install Three.js, `@pixiv/three-vrm`, React Three Fiber, or any WebGL 3D avatar renderer. (Handled natively by a Swift/Unity metal layer rendered behind a transparent web view).

---

## 2. Wrapper-Compatible Bridge & Code Stubs
Because native Swift and AWS handle all heavy processing, you must expose a clean, typed **JavaScript-to-Native Bridge** on the `window` object and build UI placeholders that gracefully accommodate native layers underneath.

### A. Global Native Bridge Interface (`src/types/nativeBridge.ts` & `src/lib/nativeBridge.ts`)
Create a global `window.NativeASLBridge` interface that allows the Swift wrapper to push real-time data into React state, and allows React UI buttons to trigger native Swift/AWS actions:

- **Inbound Methods (Called by Swift `evaluateJavaScript` -> Updates React State):**
  - `onSignDetected(payload: { gloss: string; confidence: number; isFinal: boolean; timestamp: number })`: Receives real-time recognized ASL tokens/glosses from Core ML.
  - `onSentenceTranslated(payload: { rawGloss: string; naturalEnglish: string; audioUrl?: string })`: Receives refined LLM/AWS sentence translations.
  - `onEngineStatusChange(status: { cameraActive: boolean; trackingState: 'idle' | 'tracking' | 'lost'; inferenceLatencyMs: number })`: Updates UI status badges.
  - `onTTSPlaybackState(isPlaying: boolean)`: Updates audio waveform/speaker UI indicators.

- **Outbound Stubs (Called by React UI -> Posts to `window.webkit?.messageHandlers?.aslBridge` or AWS API Stubs):**
  - `triggerCameraToggle(active: boolean)`: Sends start/stop capture command to Swift.
  - `triggerTTSPlayback(text: string, voiceId?: string)`: Requests Swift or AWS Polly to speak the translated sentence.
  - `triggerAvatarReplay(glossSequence: string[])`: Requests the native VRM signing mirror layer to replay a sign sequence.
  - `syncSessionToAWS(sessionData: unknown)`: Stubbed async service function (`src/services/awsSync.ts`) ready for AWS API Gateway / Cognito integration.

### B. Transparent Viewport & Layout Rules
- **Camera & VRM Mirror Viewports:** Wherever the live camera feed or 3D VRM signing mirror belongs in the UI, render a **transparent container (`bg-transparent`)** with a subtle dashed border, alignment reticles, and a toggleable `"Dev Preview Placeholder"` badge. Do not put opaque backgrounds behind these containers so native Swift Metal/AVFoundation layers can render visibly underneath the `WKWebView`.
- **Interactive Dev Simulator Drawer:** Include a collapsible, hidden-by-default `"Bridge Simulator"` debug panel (accessible via a small dev icon in the corner) with mock buttons to test `onSignDetected` and `onSentenceTranslated` in the browser during UI development.

---

## 3. Tech Stack & Coding Standards
- **Framework:** React, TypeScript, Vite, Tailwind CSS, Lucide Icons, shadcn/ui.
- **State Management:** Keep high-frequency incoming gloss updates decoupled from heavy layout re-renders (use clean custom hooks like `useNativeBridge()`).
- **Accessibility:** Ensure high-contrast typography, large readable live-caption banners, and clear visual feedback states (listening, translating, speaking) suitable for Deaf and Hard-of-Hearing users.
