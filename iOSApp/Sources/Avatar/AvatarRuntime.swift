import Foundation

protocol AvatarRuntime {
    func replay(glossSequence: [String], completion: @escaping (Result<Void, Error>) -> Void)
}

enum AvatarRuntimeError: LocalizedError {
    case rendererUnavailable

    var errorDescription: String? {
        "No licensed VRM renderer or avatar asset is configured."
    }
}

final class UnavailableAvatarRuntime: AvatarRuntime {
    func replay(glossSequence: [String], completion: @escaping (Result<Void, Error>) -> Void) {
        completion(.failure(AvatarRuntimeError.rendererUnavailable))
    }
}
