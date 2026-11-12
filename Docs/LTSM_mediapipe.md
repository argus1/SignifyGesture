To convert a MediaPipe LSTM pipeline into a Core ML .mlpackage, you must split the MediaPipe feature extractor from the LSTM classifier, convert the LSTM model directly from its original training format (Keras/TensorFlow or PyTorch) using Apple's coremltools, and run the MediaPipe landmark extraction natively on iOS. \[[1](https://apple.github.io/coremltools/docs-guides/source/introductory-quickstart.html), [2](https://coremltools.readme.io/v6.3/docs/unified-conversion-api)\]

Attempting to convert a bundled .tflite or .task file directly into Core ML is unsupported by coremltools and will fail due to MediaPipe's custom graph operations. \[[1](https://github.com/daisymind/MediaPipeToCoreMLmodel), [2](https://blog.xmartlabs.com/blog/t-flite-to-core-ml/)\]

Step 1: Separate MediaPipe from the LSTM Model

A MediaPipe LSTM workflow typically consists of two distinct stages:

* **MediaPipe Landmark Extraction:** Extracts body, hand, or face keypoints from video frames. Keep this step native in your Swift/iOS app using the official MediaPipe Tasks Vision iOS SDK rather than converting it.  
* **The LSTM Sequence Classifier:** Takes a sequence of extracted keypoints (e.g., shape (1, 30, 126\)) and outputs an action or gesture prediction. Export this model directly from TensorFlow/Keras or PyTorch before it gets quantized or bundled into TFLite. \[[1](https://coremltools.readme.io/v6.3/docs/unified-conversion-api)\]

Step 2: Convert the LSTM to .mlpackage

Install coremltools in your Python environment (pip install coremltools) and run the conversion script matching your training framework. \[[1](https://developer.apple.com/la/videos/play/wwdc2020/10153/), [2](https://coremltools.readme.io/v6.3/docs/unified-conversion-api)\]

**Option A: From TensorFlow / Keras (.h5 or SavedModel)**

If you trained your LSTM using TensorFlow or Keras, convert it to an ML Program and save it as an .mlpackage: \[[1](https://apple.github.io/coremltools/docs-guides/source/convert-to-ml-program.html), [2](https://coremltools.readme.io/v6.3/docs/unified-conversion-api)\]

python

```
import coremltools as ct
import tensorflow as tf

# 1. Load your trained Keras/TensorFlow LSTM model
tf_model = tf.keras.models.load_model("lstm_action_model.h5")

# 2. Convert to Core ML ML Program (default in coremltools 7.0+)
mlmodel = ct.convert(
    tf_model,
    convert_to="mlprogram",
    inputs=[ct.TensorType(name="input_sequences", shape=(1, 30, 126))], # Match your (batch, frames, keypoints)
    minimum_deployment_target=ct.target.iOS16
)

# 3. Save as an .mlpackage
mlmodel.save("ActionLSTM.mlpackage")
```

Use code with caution.

**Option B: From PyTorch (.pt or .pth)**

If your LSTM was built in PyTorch, trace the model with a dummy input tensor first: \[[1](https://huggingface.co/blog/fguzman82/frompytorch-to-coreml), [2](https://coremltools.readme.io/v6.3/docs/unified-conversion-api)\]

python

```
import coremltools as ct
import torch

# 1. Load model and set to evaluation mode
model.eval()

# 2. Trace with dummy input matching (batch_size, sequence_length, feature_count)
example_input = torch.rand(1, 30, 126)
traced_model = torch.jit.trace(model, example_input)

# 3. Convert to Core ML
mlmodel = ct.convert(
    traced_model,
    convert_to="mlprogram",
    inputs=[ct.TensorType(name="input_sequences", shape=example_input.shape)],
    minimum_deployment_target=ct.target.iOS16
)

# 4. Save as an .mlpackage
mlmodel.save("ActionLSTM.mlpackage")
```

Use code with caution.

Step 3: What If You Only Have a .tflite File?

If you do not have the original Keras or PyTorch source weights and only possess a compiled .tflite file, direct conversion is not supported. You must use an intermediate graph converter before running coremltools: \[[1](https://blog.xmartlabs.com/blog/t-flite-to-core-ml/)\]

* **Use tflite2tensorflow:** Run the open-source [tflite2tensorflow tool](https://github.com/PINTO0309/tflite2tensorflow) to unpack the TFLite flatbuffer back into a TensorFlow SavedModel or ONNX graph. \[[1](https://github.com/daisymind/MediaPipeToCoreMLmodel)\]  
* **Convert the Unpacked Model:** Once reconstructed into a standard TensorFlow SavedModel, pass that directory into ct.convert() to generate your .mlpackage. \[[1](https://apple.github.io/coremltools/docs-guides/source/convert-to-ml-program.html), [2](https://coremltools.readme.io/v6.3/docs/unified-conversion-api)\]  
* **Watch for Unrolled Loops:** TFLite often unrolls LSTM layers into dozens of individual While or tensor-slice operations, which can slow down Core ML compilation. If conversion stalls, inspect the graph in [Netron](https://netron.app/) to verify clean input/output tensor names.

Step 4: Integrate in Xcode

* **Import the Package:** Drag ActionLSTM.mlpackage directly into your Xcode project navigator. Xcode will automatically generate a Swift wrapper class.  
* **Buffer Keypoints in Swift:** Run MediaPipe's hand, pose, or face landmarker on each camera frame, append the normalized coordinates into a rolling array of N frames, convert that array into an MLMultiArray, and pass it into your Core ML model's .prediction() method.

If you'd like help troubleshooting or tailoring the conversion script, let me know:

* **Which framework** you used to train the LSTM (TensorFlow/Keras, PyTorch, or MediaPipe Model Maker)  
* **What file format** you currently have (.h5, SavedModel, .pt, or .tflite)  
* **Your input tensor shape** (number of frames and landmarks per frame)

