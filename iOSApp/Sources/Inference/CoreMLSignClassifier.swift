import CoreML
import Foundation

struct SignPrediction {
    let gloss: String
    let confidence: Double
}

protocol SignInferenceProvider {
    var availabilityError: Error? { get }

    func predict(
        sequence: [Float],
        completion: @escaping (Result<SignPrediction, Error>) -> Void
    )
}

enum SignClassifierError: LocalizedError {
    case modelUnavailable
    case modelLoadFailed(String)
    case modelInputContractMismatch
    case modelOutputContractMismatch

    var errorDescription: String? {
        switch self {
        case .modelUnavailable:
            return "No compatible sign-recognition Core ML model is bundled."
        case .modelLoadFailed(let message):
            return "The sign-recognition Core ML model could not be loaded: \(message)"
        case .modelInputContractMismatch:
            return "The sign model input does not match the documented hand-pose sequence."
        case .modelOutputContractMismatch:
            return "The sign model must expose classLabel and classProbability outputs."
        }
    }
}

final class CoreMLSignClassifier: SignInferenceProvider {
    static let modelName = "SignifyGestureClassifier"
    static let inputName = "landmarkSequence"
    static let expectedShape = [1, 16, LandmarkFrame.handCount, LandmarkFrame.jointCount, 3]

    private let model: MLModel?
    private let inferenceQueue = DispatchQueue(label: "com.argussun.signifygesture.coreml", qos: .userInitiated)
    private let loadError: SignClassifierError?

    init(bundle: Bundle = .main) {
        guard let modelURL = bundle.url(forResource: Self.modelName, withExtension: "mlmodelc") else {
            model = nil
            loadError = .modelUnavailable
            return
        }

        do {
            let configuration = MLModelConfiguration()
            configuration.computeUnits = .all
            let loadedModel = try MLModel(contentsOf: modelURL, configuration: configuration)
            guard let input = loadedModel.modelDescription.inputDescriptionsByName[Self.inputName],
                  input.type == .multiArray,
                  let shape = input.multiArrayConstraint?.shape.map(\.intValue),
                  shape == Self.expectedShape else {
                model = nil
                loadError = .modelInputContractMismatch
                return
            }
            guard loadedModel.modelDescription.outputDescriptionsByName["classLabel"]?.type == .string,
                  loadedModel.modelDescription.outputDescriptionsByName["classProbability"]?.type == .dictionary else {
                model = nil
                loadError = .modelOutputContractMismatch
                return
            }
            model = loadedModel
            loadError = nil
        } catch {
            model = nil
            loadError = .modelLoadFailed(error.localizedDescription)
        }
    }

    var availabilityError: Error? {
        loadError
    }

    func predict(
        sequence: [Float],
        completion: @escaping (Result<SignPrediction, Error>) -> Void
    ) {
        guard sequence.count == Self.expectedShape.reduce(1, *) else {
            completion(.failure(SignClassifierError.modelInputContractMismatch))
            return
        }
        guard let model else {
            completion(.failure(loadError ?? SignClassifierError.modelUnavailable))
            return
        }

        inferenceQueue.async {
            do {
                let array = try MLMultiArray(
                    shape: Self.expectedShape.map { NSNumber(value: $0) },
                    dataType: .float32
                )
                for (index, value) in sequence.enumerated() {
                    array[index] = NSNumber(value: value)
                }
                let input = try MLDictionaryFeatureProvider(dictionary: [
                    Self.inputName: MLFeatureValue(multiArray: array)
                ])
                let output = try model.prediction(from: input)
                guard let gloss = output.featureValue(for: "classLabel")?.stringValue,
                      let probabilities = output.featureValue(for: "classProbability")?.dictionaryValue,
                      let confidence = probabilities[gloss] else {
                    completion(.failure(SignClassifierError.modelOutputContractMismatch))
                    return
                }
                completion(.success(SignPrediction(gloss: gloss, confidence: confidence.doubleValue)))
            } catch {
                completion(.failure(error))
            }
        }
    }
}
