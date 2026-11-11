#if DEBUG
import AuthenticationServices
import Combine
import CryptoKit
import Foundation
import Security
import UIKit

struct CognitoAuthConfiguration {
    let hostedUIDomain: URL
    let clientID: String
    let redirectURI: URL

    init(hostedUIDomain: String, clientID: String, redirectURI: String = "signifygesture://auth/callback") throws {
        let domain = hostedUIDomain.trimmingCharacters(in: .whitespacesAndNewlines)
        let client = clientID.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let domainURL = URL(string: domain),
              let components = URLComponents(url: domainURL, resolvingAgainstBaseURL: false),
              components.scheme == "https",
              components.host != nil,
              components.user == nil,
              components.password == nil,
              components.port == nil,
              components.query == nil,
              components.fragment == nil,
              components.path.isEmpty || components.path == "/",
              !client.isEmpty,
              let callback = URL(string: redirectURI),
              let callbackScheme = callback.scheme,
              !callbackScheme.isEmpty else {
            throw CognitoAuthError.invalidConfiguration
        }
        self.hostedUIDomain = domainURL
        self.clientID = client
        self.redirectURI = callback
    }

    static func load(from bundle: Bundle = .main) throws -> CognitoAuthConfiguration {
        guard let domain = bundle.object(forInfoDictionaryKey: "SIGNIFY_COGNITO_HOSTED_UI_DOMAIN") as? String,
              let clientID = bundle.object(forInfoDictionaryKey: "SIGNIFY_COGNITO_APP_CLIENT_ID") as? String else {
            throw CognitoAuthError.missingConfiguration
        }
        return try CognitoAuthConfiguration(hostedUIDomain: domain, clientID: clientID)
    }

    func authorizationURL(state: String, codeChallenge: String) throws -> URL {
        var components = URLComponents(
            url: hostedUIDomain.appendingPathComponent("oauth2/authorize"),
            resolvingAgainstBaseURL: false
        )
        components?.queryItems = [
            URLQueryItem(name: "client_id", value: clientID),
            URLQueryItem(name: "response_type", value: "code"),
            URLQueryItem(name: "redirect_uri", value: redirectURI.absoluteString),
            URLQueryItem(name: "scope", value: "openid"),
            URLQueryItem(name: "state", value: state),
            URLQueryItem(name: "code_challenge", value: codeChallenge),
            URLQueryItem(name: "code_challenge_method", value: "S256")
        ]
        guard let url = components?.url else { throw CognitoAuthError.invalidConfiguration }
        return url
    }

    func endpoint(_ path: String) throws -> URL {
        guard let url = URL(string: path, relativeTo: hostedUIDomain)?.absoluteURL else {
            throw CognitoAuthError.invalidConfiguration
        }
        return url
    }
}

@MainActor
final class CognitoAuthService: NSObject, ObservableObject, ASWebAuthenticationPresentationContextProviding {
    @Published private(set) var isAuthenticated = false
    @Published private(set) var isAuthenticating = false
    @Published private(set) var configurationMessage: String?
    @Published var errorMessage: String?

    private let configuration: CognitoAuthConfiguration?
    private var authSession: ASWebAuthenticationSession?

    override init() {
        do {
            configuration = try CognitoAuthConfiguration.load()
        } catch {
            configuration = nil
            configurationMessage = "\(error.localizedDescription) Configure SIGNIFY_COGNITO_HOSTED_UI_DOMAIN and SIGNIFY_COGNITO_APP_CLIENT_ID in iOSApp/Config/Local.xcconfig."
        }
        super.init()
        do {
            isAuthenticated = try Self.loadTokens() != nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func signIn() async {
        guard !isAuthenticating else { return }
        guard let configuration else {
            errorMessage = configurationMessage ?? CognitoAuthError.missingConfiguration.localizedDescription
            return
        }
        isAuthenticating = true
        errorMessage = nil
        defer { isAuthenticating = false }

        do {
            let verifier = try Self.randomURLSafeString()
            let state = try Self.randomURLSafeString()
            let challenge = Self.sha256(verifier)
            let authorizationURL = try configuration.authorizationURL(state: state, codeChallenge: challenge)
            let callbackURL = try await authenticate(at: authorizationURL, callbackScheme: configuration.redirectURI.scheme)
            guard let callbackComponents = URLComponents(url: callbackURL, resolvingAgainstBaseURL: false),
                  callbackComponents.scheme == configuration.redirectURI.scheme,
                  callbackComponents.host == configuration.redirectURI.host,
                  callbackComponents.path == configuration.redirectURI.path else {
                throw CognitoAuthError.invalidCallback
            }
            let query = callbackComponents.queryItems ?? []
            guard query.first(where: { $0.name == "state" })?.value == state,
                  let code = query.first(where: { $0.name == "code" })?.value,
                  !code.isEmpty else {
                if let description = query.first(where: { $0.name == "error_description" })?.value {
                    throw CognitoAuthError.authorizationRejected(description)
                }
                throw CognitoAuthError.invalidCallback
            }

            let tokenResponse = try await requestTokens(
                configuration: configuration,
                form: [
                    ("grant_type", "authorization_code"),
                    ("client_id", configuration.clientID),
                    ("code", code),
                    ("redirect_uri", configuration.redirectURI.absoluteString),
                    ("code_verifier", verifier)
                ]
            )
            let tokens = try Self.makeStoredTokens(from: tokenResponse)
            try Self.saveTokens(tokens)
            isAuthenticated = true
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func accessToken() async throws -> String {
        guard let configuration else { throw CognitoAuthError.missingConfiguration }
        guard let current = try Self.loadTokens() else { throw CognitoAuthError.notAuthenticated }
        if current.expiresAt.timeIntervalSinceNow > 60 {
            return current.accessToken
        }
        guard !current.refreshToken.isEmpty else {
            try Self.deleteTokens()
            isAuthenticated = false
            throw CognitoAuthError.reauthenticationRequired
        }

        let response = try await requestTokens(
            configuration: configuration,
            form: [
                ("grant_type", "refresh_token"),
                ("client_id", configuration.clientID),
                ("refresh_token", current.refreshToken)
            ]
        )
        var refreshed = try Self.makeStoredTokens(from: response)
        if refreshed.refreshToken.isEmpty {
            refreshed.refreshToken = current.refreshToken
        }
        try Self.saveTokens(refreshed)
        isAuthenticated = true
        return refreshed.accessToken
    }

    func signOut() async {
        do {
            if let tokens = try Self.loadTokens(),
               !tokens.refreshToken.isEmpty,
               let configuration {
                try await revoke(tokens.refreshToken, configuration: configuration)
            }
            try Self.deleteTokens()
            isAuthenticated = false
            errorMessage = nil
        } catch {
            let revocationMessage = error.localizedDescription
            do {
                try Self.deleteTokens()
                isAuthenticated = false
                errorMessage = "Signed out on this device, but Cognito token revocation failed: \(revocationMessage)"
            } catch {
                errorMessage = "Could not remove the saved sign-in from this device: \(error.localizedDescription)"
            }
        }
    }

    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap(\.windows)
            .first(where: \.isKeyWindow) ?? UIWindow()
    }

    private func authenticate(at url: URL, callbackScheme: String?) async throws -> URL {
        guard let callbackScheme else { throw CognitoAuthError.invalidConfiguration }
        return try await withCheckedThrowingContinuation { continuation in
            let session = ASWebAuthenticationSession(url: url, callbackURLScheme: callbackScheme) { [weak self] callbackURL, error in
                Task { @MainActor in
                    self?.authSession = nil
                    if let error {
                        if let authError = error as? ASWebAuthenticationSessionError,
                           authError.code == .canceledLogin {
                            continuation.resume(throwing: CognitoAuthError.cancelled)
                        } else {
                            continuation.resume(throwing: error)
                        }
                    } else if let callbackURL {
                        continuation.resume(returning: callbackURL)
                    } else {
                        continuation.resume(throwing: CognitoAuthError.invalidCallback)
                    }
                }
            }
            session.presentationContextProvider = self
            authSession = session
            guard session.start() else {
                authSession = nil
                continuation.resume(throwing: CognitoAuthError.authenticationUnavailable)
                return
            }
        }
    }

    private func requestTokens(
        configuration: CognitoAuthConfiguration,
        form: [(String, String)]
    ) async throws -> CognitoTokenResponse {
        var request = URLRequest(url: try configuration.endpoint("/oauth2/token"))
        request.httpMethod = "POST"
        request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        request.httpBody = Self.formEncoded(form)
        let (data, response) = try await URLSession.shared.data(for: request)
        try Self.validate(response)
        let tokenResponse = try JSONDecoder().decode(CognitoTokenResponse.self, from: data)
        guard tokenResponse.tokenType.caseInsensitiveCompare("Bearer") == .orderedSame,
              !tokenResponse.accessToken.isEmpty,
              tokenResponse.expiresIn > 0 else {
            throw CognitoAuthError.invalidTokenResponse
        }
        return tokenResponse
    }

    private func revoke(_ refreshToken: String, configuration: CognitoAuthConfiguration) async throws {
        var request = URLRequest(url: try configuration.endpoint("/oauth2/revoke"))
        request.httpMethod = "POST"
        request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        request.httpBody = Self.formEncoded([
            ("token", refreshToken),
            ("client_id", configuration.clientID)
        ])
        let (_, response) = try await URLSession.shared.data(for: request)
        try Self.validate(response)
    }

    private static func makeStoredTokens(from response: CognitoTokenResponse) throws -> StoredCognitoTokens {
        guard !response.accessToken.isEmpty, response.expiresIn > 0 else {
            throw CognitoAuthError.invalidTokenResponse
        }
        return StoredCognitoTokens(
            accessToken: response.accessToken,
            refreshToken: response.refreshToken ?? "",
            expiresAt: Date().addingTimeInterval(TimeInterval(response.expiresIn))
        )
    }

    private static func validate(_ response: URLResponse) throws {
        guard let httpResponse = response as? HTTPURLResponse else {
            throw CognitoAuthError.invalidServerResponse
        }
        guard (200..<300).contains(httpResponse.statusCode) else {
            throw CognitoAuthError.serverRejected(httpResponse.statusCode)
        }
    }

    private static func formEncoded(_ values: [(String, String)]) -> Data? {
        var components = URLComponents()
        components.queryItems = values.map { URLQueryItem(name: $0.0, value: $0.1) }
        return components.percentEncodedQuery?.data(using: .utf8)
    }

    private static func randomURLSafeString() throws -> String {
        var bytes = [UInt8](repeating: 0, count: 32)
        guard SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes) == errSecSuccess else {
            throw CognitoAuthError.randomGenerationFailed
        }
        return Data(bytes).base64URLEncodedString()
    }

    private static func sha256(_ value: String) -> String {
        let digest = Data(SHA256.hash(data: Data(value.utf8)))
        return digest.base64URLEncodedString()
    }

    private static func loadTokens() throws -> StoredCognitoTokens? {
        var query = keychainQuery
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        if status == errSecItemNotFound { return nil }
        guard status == errSecSuccess, let data = result as? Data else {
            throw CognitoAuthError.keychain(status)
        }
        return try JSONDecoder().decode(StoredCognitoTokens.self, from: data)
    }

    private static func saveTokens(_ tokens: StoredCognitoTokens) throws {
        let data = try JSONEncoder().encode(tokens)
        let attributes: [String: Any] = [
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        ]
        let status = SecItemUpdate(keychainQuery as CFDictionary, attributes as CFDictionary)
        if status == errSecItemNotFound {
            var query = keychainQuery
            attributes.forEach { query[$0.key] = $0.value }
            let addStatus = SecItemAdd(query as CFDictionary, nil)
            guard addStatus == errSecSuccess else { throw CognitoAuthError.keychain(addStatus) }
        } else if status != errSecSuccess {
            throw CognitoAuthError.keychain(status)
        }
    }

    private static func deleteTokens() throws {
        let status = SecItemDelete(keychainQuery as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw CognitoAuthError.keychain(status)
        }
    }

    private static var keychainQuery: [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: Bundle.main.bundleIdentifier ?? "SignifyGesture",
            kSecAttrAccount as String: "cognito-oauth-tokens"
        ]
    }
}

private struct CognitoTokenResponse: Decodable {
    let accessToken: String
    let refreshToken: String?
    let tokenType: String
    let expiresIn: Int

    enum CodingKeys: String, CodingKey {
        case accessToken = "access_token"
        case refreshToken = "refresh_token"
        case tokenType = "token_type"
        case expiresIn = "expires_in"
    }
}

private struct StoredCognitoTokens: Codable {
    let accessToken: String
    var refreshToken: String
    let expiresAt: Date
}

private enum CognitoAuthError: LocalizedError {
    case missingConfiguration
    case invalidConfiguration
    case authorizationRejected(String)
    case invalidCallback
    case authenticationUnavailable
    case cancelled
    case invalidTokenResponse
    case invalidServerResponse
    case serverRejected(Int)
    case notAuthenticated
    case reauthenticationRequired
    case randomGenerationFailed
    case keychain(OSStatus)

    var errorDescription: String? {
        switch self {
        case .missingConfiguration:
            return "Cognito sign-in is not configured."
        case .invalidConfiguration:
            return "Cognito configuration is invalid. The hosted UI domain must use HTTPS."
        case .authorizationRejected(let message):
            return "Cognito did not authorize sign-in: \(message)"
        case .invalidCallback:
            return "Cognito returned an invalid sign-in callback."
        case .authenticationUnavailable:
            return "Could not start the iOS authentication session."
        case .cancelled:
            return "Sign-in was canceled."
        case .invalidTokenResponse:
            return "Cognito returned an invalid token response."
        case .invalidServerResponse:
            return "Cognito returned an invalid HTTP response."
        case .serverRejected(let status):
            return "Cognito rejected the request (HTTP \(status))."
        case .notAuthenticated:
            return "Sign in with Cognito before requesting upload authorization."
        case .reauthenticationRequired:
            return "Your Cognito session expired. Sign in again."
        case .randomGenerationFailed:
            return "Could not securely generate the sign-in challenge."
        case .keychain(let status):
            return "Could not securely store or read the Cognito session (Keychain status \(status))."
        }
    }
}

private extension Data {
    func base64URLEncodedString() -> String {
        base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }
}
#endif
