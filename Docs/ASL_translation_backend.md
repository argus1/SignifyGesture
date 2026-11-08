To build a real-time American Sign Language (ASL) transcription-to-Text-to-Speech (TTS) pipeline on iOS using **ARKit**, **Unity**, and **UniVRM**, you need a hybrid architecture. Because Unity handles the [**UniVRM**](https://github.com/vrm-c/UniVRM) avatar and **ARKit Face Tracking** natively, but lacks native high-performance tools for hand skeleton translation and iOS local TTS, you will cross the bridge between Unity's C\# and iOS native Swift/Objective-C.

Here is the architecture and implementation strategy to achieve this.

---

🏗️ High-Level Pipeline Architecture

1. **Input (ARKit):** Unity's **XR Face Tracking Subsystem** captures facial blendshapes. For hand gestures, ARKit alone is insufficient on iOS; you must use **Apple's Vision Framework (VNDetectHumanHandPoseRequest)** inside a native iOS plugin to get high-fidelity 3D hand joints.  
2. **Translation Processing (Core ML):** The raw hand joint coordinates and facial blendshapes are passed into a customized **Core ML** sequence model (like a Transformer or LSTM) to transcribe gestures into text tokens.  
3. **Avatar Mirroring (UniVRM):** The hand poses and blendshapes are simultaneously fed into the **UniVRM** component to animate your VRM avatar in real time.  
4. **Output (TTS):** The transcribed text tokens are sent to a native iOS layer using **AVSpeechSynthesizer** for real-time speech output.

---

🛠️ Step-by-Step Implementation Strategy

**1\. Setup the Unity Project & UniVRM**

* Install **AR Foundation** and the **Apple ARKit XR Plugin** via the Unity Package Manager.  
* Import the **UniVRM** package into Unity to load and parse your .vrm avatar model.  
* Map the incoming ARKit blendshapes (e.g., jawOpen, mouthSmileLeft) to the VRM BlendShapeAvatars via a custom C\# controller script to mirror expressions onto the character.

**2\. Create a Native iOS Plugin for Hand Tracking & Core ML**

Unity's ARKit plugin does not expose full hand-skeleton joints on iOS (as Apple reserves ARKit Hand Tracking primarily for visionOS). To track fingers for ASL:

* Write a **native iOS plugin (.mm and .swift files)** placed in your Unity project's Assets/Plugins/iOS directory.  
* In the plugin, hook into the ARKit frame updates (ARSessionDelegate) and pass the pixel buffer to Apple's **Vision Framework**:  
  swift

```
let handPoseRequest = VNDetectHumanHandPoseRequest()
handPoseRequest.maximumHandCount = 2

let handler = VNImageRequestHandler(cvPixelBuffer: pixelBuffer, options: [:])
try? handler.perform([handPoseRequest])
```

*   
  Use code with caution.  
* Extract the 21 landmarks per hand (VNRecognizedPointKey) and pass these arrays back to Unity or straight into your **Core ML** ASL model inside the native layer.

**3\. Build the ASL Transcription Layer**

* Train your ASL translation model (or convert an existing PyTorch model) into a **.mlmodel / .mlpackage** format using **CoreMLTools**.  
* Run the frame-by-frame joint coordinates through this Core ML model locally on-device via your native plugin to leverage the Apple Neural Engine (ANE) for low-latency inference.  
* Return the transcribed strings (words or letters) to Unity via a C\# callback string delegate.

**4\. Implement Native TTS Pipeline**

Instead of relying on heavy third-party Unity assets, trigger the iOS native speech synthesis framework through your plugin bridge:

swift

```
import AVFoundation

@objc public class NativeSpeechBridge: NSObject {
    let synthesizer = AVSpeechSynthesizer()
    
    @objc public func speakText(_ text: String) {
        let utterance = AVSpeechUtterance(string: text)
        utterance.voice = AVSpeechSynthesisVoice(language: "en-US")
        utterance.rate = 0.5 // Adjust speech speed
        
        if synthesizer.isSpeaking {
            synthesizer.stopSpeaking(at: .immediate)
        }
        synthesizer.speak(utterance)
    }
}
```

Use code with caution.

Expose this method via extern "C" functions so your Unity C\# scripts can call speakText(transcribedString) immediately when a gesture phrase is recognized.

---

⚠️ Critical Trade-offs & Limitations

| Feature Component | The Challenge | The Resolution |
| ----- | ----- | ----- |
| **ARKit Hand Tracking** | iOS ARKit does not provide full 3D hand skeletons like visionOS does. | You **must** combine ARKit (for face/camera) with the native iOS **Vision Framework** for hand tracking. |
| **Performance Overhead** | Running Vision hand pose \+ ARKit face tracking \+ Core ML \+ Unity rendering can drop framerates. | Move the Vision and Core ML tasks onto background GCD threads in Swift, keeping the Unity main thread dedicated to rendering the VRM avatar. |
| **Sign Language Scope** | Fingerspelling (alphabet) is straightforward; dynamic sentence translation requires context. | Use an LSTM or Transformer-based Core ML model that accepts a time-series sequence of frames rather than individual static frames. |

Additional challenges are **writing the Swift-to-C\# native plugin bridge** for the hand tracking data, or **structuring the Core ML sequence model** for dynamic translation.

Removing the avatar drastically reduces complexity. By eliminating Unity and UniVRM, you no longer have to manage a heavy 3D engine, bridge C\# and Swift, handle 3D rendering overhead, or map complex blendshapes.

Instead of a cross-platform hybrid build, your project becomes a **100% native iOS Swift app**. This reduces battery drain, minimizes application size, and keeps your entire codebase in a single language.

Here is what the architecture, performance landscape, and implementation flow look like without an avatar.

---

📱 The Streamlined Native Swift Pipeline

Without an avatar, the system transforms into a pure data-processing pipeline that runs entirely on Apple's native frameworks:

```
[Camera Input] 
      │
      ▼
[Apple Vision Framework] ──► Extracts 21 Hand Joint Coordinates (3D Vectors)
      │
      ▼
   [Core ML]             ──► Evaluates spatial sequences (Predicts Text Tokens)
      │
      ▼
[AVSpeechSynthesizer]    ──► Converts Text to Audio Output (Spoken Word)
```

---

🔄 The Development Workflow (No Unity, No VRM)

**1\. Setup the UI and Camera (UIKit or SwiftUI)**

* Build your interface entirely in **SwiftUI**.  
* Create a live camera preview layer using **AVFoundation** (AVCaptureSession).  
* Overlay a simple text box at the bottom of the screen to display the transcribed text before it speaks.

**2\. Frame Extraction & Hand Tracking (Vision Framework)**

Instead of writing native plugin hooks to send frames into Unity, you capture frames directly in Swift:

* Set your camera data output delegate to intercept video frames in real time.  
* Pass the CVImageBuffer directly to **VNDetectHumanHandPoseRequest**.  
* Extract the 21 landmarks (.wrist, .thumbTip, .indexTip, etc.) as an array of matrices or coordinate points.

**3\. Sign Language Inference (Core ML)**

* Take the array of hand joint coordinates and feed them directly into your **Core ML model** (.mlmodelc format compiled inside Xcode).  
* Since you aren't rendering a 3D avatar, you can allocate almost the entirety of the **Apple Neural Engine (ANE)** and GPU to inference, allowing you to use more accurate, deeper sequence models (like a lightweight Transformer) without dropping camera frame rates.

**4\. Instant Audio Output (AVFoundation)**

* When the Core ML model outputs a completed word or token, pass it straight to your native **AVSpeechSynthesizer** instance to speak the text out loud.

---

📊 Structural Comparison: Avatar vs. No Avatar

| Feature | Hybrid Setup (With Avatar) | Pure Native Setup (No Avatar) |
| ----- | ----- | ----- |
| **Engine Requirements** | Unity Engine \+ Xcode | Xcode Only |
| **Languages Used** | C\# (Unity) \+ Swift/Objective-C (Plugins) | Swift Only |
| **App Size** | Large (\~150MB+ due to Unity runtime & VRM textures) | Small (\~20MB–50MB depending on Core ML model) |
| **Battery & Thermal** | High drain (Rendering 3D graphics \+ ML tracking simultaneously) | Moderate drain (Pure mathematical calculation, low display strain) |
| **Primary Challenge** | Threading data across the C\#/Swift bridge without UI stuttering | Training a highly accurate Core ML model |

To convert a model to Core ML for a native iOS app, you should look for models that ingest **skeleton coordinates (landmarks)** rather than raw video frames.

Because Apple’s **Vision Framework** provides the coordinates of 21 hand points in real time on the device, using a coordinate-based model lets you skip heavy video-processing architectures (like 3D-CNNs) and directly pass an array of numbers into **Core ML**. This maps perfectly to the Apple Neural Engine (ANE) for near-zero latency. \[[1](https://developer.apple.com/documentation/coreml), [2](https://www.youtube.com/watch?v=MdlyLT_y3i0&t=207)\]

The best open-source model frameworks and datasets to target for your PyTorch/TensorFlow-to-CoreML pipeline include the following:

---

1\. The Standard Baseline: CNN \+ LSTM / GRU Networks

This architecture treats your data as a time series: the spatial relationships of the hand joints in a single frame are analyzed by a dense neural network or a 1D-CNN, and the sequence over time is processed by an LSTM to predict the word or letter. \[[1](https://github.com/topics/sign-language-recognition), [2](https://www.researchgate.net/publication/366773922_Gesture_Recognition_for_American_Sign_Language_Using_Pytorch_and_Convolutional_Neural_Network)\]

* **Why it converts beautifully:** Recurrent layers like nn.LSTM or nn.GRU in PyTorch have explicit, first-class support in coremltools. They easily translate into Core ML neural networks or ML Program types. \[[1](https://apple.github.io/coremltools/docs-guides/source/convert-nlp-model.html)\]  
* **Where to find them:** Search GitHub for repositories with topics like sign-language-recognition cnn-lstm or repositories targeting the **WLASL (Word-Level American Sign Language)** dataset. \[[1](https://oa.upm.es/76743/1/Interpreting.pdf), [2](https://github.com/topics/sign-language-recognition)\]  
* **Data footprint:** Extremely lightweight (often under 15MB), making them ideal for running silently in the background on an iPhone.

2\. The Modern Choice: Landmark-Based Transformers

Instead of LSTMs, these architectures utilize multi-head self-attention mechanisms to determine which frames and joint movements matter most over a time sequence. \[[1](https://aclanthology.org/2020.lrec-1.737/), [2](https://oa.upm.es/76743/1/Interpreting.pdf)\]

* **Why it works:** Open-source architectures derived from the Google ASL Kaggle competitions (such as [**Isolated Sign Language Recognition Models on GitHub**](https://github.com/topics/sign-language-recognition)) typically utilize landmark data. \[[1](https://github.com/topics/sign-language-recognition)\]  
* **Conversion strategy:** You can convert PyTorch Transformers into Core ML by replacing dynamic sequence-length operations with static tensors (e.g., fixed contexts of 30 or 60 frames per gesture). coremltools supports PyTorch multi-head attention components directly.

3\. Apple Research: ASL Citizen Base Models

If you want something structurally aligned with Apple ecosystems, reference [**Apple Machine Learning Research on Sign Language**](https://machinelearning.apple.com/research/sign-language-annotations). They published work mapping state-of-the-art isolated sign recognizers (ISR) on the **ASL Citizen dataset**. \[[1](https://machinelearning.apple.com/research/sign-language-annotations)\]

* Look up open-source PyTorch implementations trained on the **ASL Citizen** or **FSBoard (Fingerspelling)** datasets. Because these networks process sparse landmark tracking rather than full images, they are perfectly suited for conversion via coremltools. \[[1](https://machinelearning.apple.com/research/sign-language-annotations)\]

---

🛠️ The Core ML Conversion Blueprint (PyTorch to .mlpackage)

When you find a model on GitHub or Hugging Face, you can use **coremltools** in Python to convert it. Here is the structural logic for converting a landmark model: \[[1](https://apple.github.io/coremltools/docs-guides/source/convert-nlp-model.html)\]

python

```
import torch
import coremltools as ct

# 1. Instantiate the model architecture found from open-source repository
pytorch_model = ASLTransformerModel(num_classes=100) 
pytorch_model.load_state_dict(torch.load("asl_weights.pt"))
pytorch_model.eval()

# 2. Trace with a dummy input 
# Example shape: [Batch, TimeFrames, 21_Landmarks * 3_Coordinates]
dummy_input = torch.rand(1, 30, 63) 
traced_model = torch.jit.trace(pytorch_model, dummy_input)

# 3. Convert to CoreML Package format (.mlpackage)
coreml_model = ct.convert(
    traced_model,
    inputs=[ct.TensorType(shape=dummy_input.shape, name="hand_landmarks")],
    outputs=[ct.TensorType(name="predicted_tokens")]
)

# 4. Save for Xcode
coreml_model.save("ASLTranscriptionModel.mlpackage")
```

Use code with caution.

⚠️ Conversion Hazards to Avoid

* **Dynamic Time Constraints:** Core ML runs best with static dimensions. Ensure your model clips or pads gesture sequences to a fixed frame window (e.g., exactly 30 frames) before execution.  
* **Coordinate Space Matching:** Open-source models are often trained on Google MediaPipe landmark outputs. Apple's Vision Framework has slightly different normalization rules and axis structures. You will need a lightweight mapping step in Swift to transform the raw Vision points to match the input alignment expected by your converted model. \[[1](https://github.com/jaganov/google_asl_recognition), [2](https://oa.upm.es/76743/1/Interpreting.pdf)\]

Important is also intention to recognize **isolated words and alphabet fingerspelling**, or  aiming for **continuous full-sentence translation**.  We’ll need agentic help tailoring the input/output shape configurations based on our dataset choice.

Here is the complete, copy-pasteable Swift template for a native iOS pipeline. It configures AVFoundation to capture camera frames at high speed, immediately processes them on a background queue using the Vision Framework to track 21 hand landmarks, and returns the results safely to the main thread.

swift

```
import SwiftUI
import AVFoundation
import Vision

// MARK: - Camera Manager Delegate
protocol CameraManagerDelegate: AnyObject {
    func didUpdateHandLandmarks(leftHand: [VNRecognizedPoint]?, rightHand: [VNRecognizedPoint]?)
    func didUpdateError(_ error: String)
}

// MARK: - Camera & Vision Processing Manager
class ASLCameraManager: NSObject, ObservableObject {
    weak var delegate: CameraManagerDelegate?
    
    let captureSession = AVCaptureSession()
    private let videoOutput = AVCaptureVideoDataOutput()
    private let videoQueue = DispatchQueue(label: "com.asl.pipeline.videoQueue", qos: .userInteractive)
    
    override init() {
        super.init()
        setupCaptureSession()
    }
    
    private func setupCaptureSession() {
        captureSession.beginConfiguration()
        
        // 1. Configure Input (Front camera for self-signing)
        guard let videoDevice = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .front),
              let videoDeviceInput = try? AVCaptureDeviceInput(device: videoDevice),
              captureSession.canAddInput(videoDeviceInput) else {
            delegate?.didUpdateError("Failed to access front camera.")
            return
        }
        captureSession.addInput(videoDeviceInput)
        
        // 2. Configure Output Frame Loop
        if captureSession.canAddOutput(videoOutput) {
            captureSession.addOutput(videoOutput)
            videoOutput.alwaysDiscardsLateVideoFrames = true
            videoOutput.videoSettings = [kCVPixelBufferPixelFormatTypeKey as String: Int(kCVPixelFormatType_420YpCbCr8BiPlanarFullRange)]
            videoOutput.setSampleBufferDelegate(self, queue: videoQueue)
        } else {
            delegate?.didUpdateError("Failed to add video output.")
            return
        }
        
        // 3. Force Landscape/Portrait alignment match
        if let connection = videoOutput.connection(with: .video) {
            connection.videoOrientation = .portrait
            if connection.isVideoMirroringSupported {
                connection.isVideoMirrored = true // Mirror so signing feels natural
            }
        }
        
        captureSession.commitConfiguration()
    }
    
    func startSession() {
        guard !captureSession.isRunning else { return }
        // Run on background thread to prevent UI freezing on initialization
        DispatchQueue.global(qos: .background).async {
            self.captureSession.startRunning()
        }
    }
    
    func stopSession() {
        guard captureSession.isRunning else { return }
        captureSession.stopRunning()
    }
}

// MARK: - AVFoundation Sample Buffer Delegate Loop
extension ASLCameraManager: AVCaptureVideoDataOutputSampleBufferDelegate {
    func captureOutput(_ output: AVCaptureOutput, didOutput sampleBuffer: CMSampleBuffer, from connection: AVCaptureConnection) {
        guard let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }
        
        // Create Vision Hand Pose Request
        let handPoseRequest = VNDetectHumanHandPoseRequest()
        handPoseRequest.maximumHandCount = 2 // Detect both signing hands
        
        let handler = VNImageRequestHandler(cvPixelBuffer: pixelBuffer, orientation: .up, options: [:])
        
        do {
            try handler.perform([handPoseRequest])
            
            guard let results = handPoseRequest.results, !results.isEmpty else {
                // No hands detected in frame
                delegate?.didUpdateHandLandmarks(leftHand: nil, rightHand: nil)
                return
            }
            
            var processedLeftPoints: [VNRecognizedPoint]?
            var processedRightPoints: [VNRecognizedPoint]?
            
            for observation in results {
                // Extract all 21 keypoints for the recognized hand
                if let allPointsDictionary = try? observation.recognizedPoints(.all) {
                    // Vision framework handles chirality (left vs right hand orientation)
                    let pointsArray = Array(allPointsDictionary.values)
                    
                    if observation.chirality == .left {
                        processedLeftPoints = pointsArray
                    } else if observation.chirality == .right {
                        processedRightPoints = pointsArray
                    }
                }
            }
            
            // Dispatch coordinate data back to UI thread
            DispatchQueue.main.async {
                self.delegate?.didUpdateHandLandmarks(leftHand: processedLeftPoints, rightHand: processedRightPoints)
            }
            
        } catch {
            DispatchQueue.main.async {
                self.delegate?.didUpdateError("Vision inference error: \(error.localizedDescription)")
            }
        }
    }
}

// MARK: - SwiftUI Preview Bridge View
struct CameraPreviewView: UIViewRepresentable {
    let session: AVCaptureSession
    
    func makeUIView(context: Context) -> UIView {
        let view = UIView(frame: UIScreen.main.bounds)
        let previewLayer = AVCaptureVideoPreviewLayer(session: session)
        previewLayer.frame = view.bounds
        previewLayer.videoGravity = .resizeAspectFill
        view.layer.addSublayer(previewLayer)
        return view
    }
    
    func updateUIView(_ uiView: UIView, context: Context) {
        if let layer = uiView.layer.sublayers?.first as? AVCaptureVideoPreviewLayer {
            layer.frame = uiView.bounds
        }
    }
}

// MARK: - Main Application View
struct ASLPipelineContainerView: View, CameraManagerDelegate {
    @StateObject private var cameraManager = ASLCameraManager()
    @State private var statusMessage: String = "Waiting for hands..."
    @State private var isLeftHandVisible = false
    @State private var isRightHandVisible = false
    
    var body: some View {
        ZStack {
            // Live Camera View Layer
            CameraPreviewView(session: cameraManager.captureSession)
                .edgesIgnoringSafeArea(.all)
            
            // UI Overlay Layer
            VStack {
                Text("ASL Live Transcription Pipeline")
                    .font(.headline)
                    .padding()
                    .background(.ultraThinMaterial)
                    .cornerRadius(10)
                    .padding(.top)
                
                Spacer()
                
                // Real-time tracking telemetry HUD
                VStack(alignment: .leading, spacing: 8) {
                    Text(statusMessage)
                        .font(.body)
                        .bold()
                    
                    HStack {
                        Label("Left Hand", systemImage: isLeftHandVisible ? "hand.raised.fill" : "hand.raised")
                            .foregroundColor(isLeftHandVisible ? .green : .red)
                        Spacer()
                        Label("Right Hand", systemImage: isRightHandVisible ? "hand.raised.fill" : "hand.raised")
                            .foregroundColor(isRightHandVisible ? .green : .red)
                    }
                }
                .padding()
                .background(.ultraThinMaterial)
                .cornerRadius(12)
                .padding()
            }
        }
        .onAppear {
            cameraManager.delegate = self
            cameraManager.startSession()
        }
        .onDisappear {
            cameraManager.stopSession()
        }
    }
    
    // MARK: - Pipeline Callback Gateways
    func didUpdateHandLandmarks(leftHand: [VNRecognizedPoint]?, rightHand: [VNRecognizedPoint]?) {
        isLeftHandVisible = leftHand != nil
        isRightHandVisible = rightHand != nil
        
        if isLeftHandVisible || isRightHandVisible {
            let leftCount = leftHand?.count ?? 0
            let rightCount = rightHand?.count ?? 0
            statusMessage = "Tracking: L (\(leftCount) pts) | R (\(rightCount) pts)"
            
            // NEXT STEP: Flatten raw points into an array of Floats and feed to CoreML model.
            // Example: let rawX = leftHand?.first?.x
        } else {
            statusMessage = "No hands in frame."
        }
    }
    
    func didUpdateError(_ error: String) {
        statusMessage = "Error: \(error)"
    }
}
```

Use code with caution.

🧠 Performance Architectural Choices In This Snippet:

* **videoQueue Initialization:** It is configured with .userInteractive Quality of Service (QoS) running entirely away from the main loop to ensure frame processing never makes the UI stutter.  
* **Pixel Format kCVPixelFormatType\_420YpCbCr8BiPlanarFullRange:** This sets up two-plane YCbCr encoding, which is natively supported by the iPhone camera sensor and requires the lowest conversion footprint when ingested by Apple's Neural Engine via Vision.  
* **Chirality Handling:** The Vision API calculates whether the captured coordinates belong to a left or right hand natively, enabling multi-handed signing models without custom sorting scripts.

We may also need agentic help creating the mapping helper functions to transform these **VNRecognizedPoint landmarks into flat Float arrays/MLMultiArrays** for specific Core ML model inputs.

