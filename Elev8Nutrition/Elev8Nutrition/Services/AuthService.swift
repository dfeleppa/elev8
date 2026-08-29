import Foundation
import AuthenticationServices
import Supabase

@MainActor
final class AuthService: ObservableObject {
    @Published private(set) var session: Session?
    @Published private(set) var isRestoring = false
    @Published var lastError: String?

    let client: SupabaseClient
    private var listenTask: Task<Void, Never>?
    private var restoreTask: Task<Void, Never>?

    init(client: SupabaseClient) {
        self.client = client
        listenTask = Task { [weak self] in
            await self?.listenForAuthChanges()
        }
        restoreTask = Task { [weak self] in
            await self?.restorePersistedSession()
        }
    }

    deinit {
        listenTask?.cancel()
        restoreTask?.cancel()
    }

    var userId: UUID? { session?.user.id }
    var email: String? { session?.user.email }
    var isSignedIn: Bool { session != nil }

    func signIn(email: String, password: String) async throws {
        lastError = nil
        let session = try await client.auth.signIn(email: email, password: password)
        self.session = session
    }

    func signInWithGoogle() async throws {
        lastError = nil
        let session = try await client.auth.signInWithOAuth(
            provider: .google,
            redirectTo: AppEnvironment.oauthRedirectURL
        )
        self.session = session
    }

    /// Returns `true` when a session exists immediately. `false` means email confirmation is required.
    @discardableResult
    func signUp(email: String, password: String) async throws -> Bool {
        lastError = nil
        let response = try await client.auth.signUp(email: email, password: password)
        session = response.session
        return response.session != nil
    }

    func signOut() async {
        lastError = nil
        do {
            try await client.auth.signOut()
        } catch {
            lastError = error.localizedDescription
        }
        session = nil
    }

    private func listenForAuthChanges() async {
        for await (event, session) in client.auth.authStateChanges {
            switch event {
            case .initialSession:
                if let session {
                    self.session = session
                }
                finishRestoring()
            case .signedOut:
                self.session = nil
                finishRestoring()
            case .signedIn, .tokenRefreshed, .userUpdated:
                self.session = session
                finishRestoring()
            default:
                break
            }
        }
    }

    private func restorePersistedSession() async {
        do {
            session = try await client.auth.session
        } catch {
            // No persisted session is the normal signed-out state. The auth
            // stream remains active for email and OAuth sign-ins.
        }
    }

    private func finishRestoring() {
        isRestoring = false
    }
}
