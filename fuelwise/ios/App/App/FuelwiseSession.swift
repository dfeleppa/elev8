import Foundation
import Supabase

enum FuelwiseError: LocalizedError {
    case notConfigured
    case accountNotLinked
    case noMealToCopy
    case sameMealDestination

    var errorDescription: String? {
        switch self {
        case .notConfigured: return "Fuelwise needs its Supabase URL and publishable key."
        case .accountNotLinked: return "Your signed-in account is not linked to an Elev8 member profile."
        case .noMealToCopy: return "That meal has no foods to copy."
        case .sameMealDestination: return "Choose a different day or destination meal."
        }
    }
}

enum FuelwiseEnvironment {
    static let oauthRedirectURL = URL(string: "fuelwise://auth-callback")!

    static var supabaseURLString: String {
        (Bundle.main.object(forInfoDictionaryKey: "SUPABASE_URL") as? String)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    }

    static var supabaseAnonKey: String {
        (Bundle.main.object(forInfoDictionaryKey: "SUPABASE_ANON_KEY") as? String)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    }

    static var isConfigured: Bool {
        supabaseURLString.hasPrefix("https://")
            && !supabaseURLString.contains("YOUR-PROJECT")
            && supabaseAnonKey.count >= 20
            && !supabaseAnonKey.contains("YOUR_SUPABASE_ANON_KEY")
    }

    static func makeClient() throws -> SupabaseClient {
        guard isConfigured, let url = URL(string: supabaseURLString) else { throw FuelwiseError.notConfigured }
        return SupabaseClient(
            supabaseURL: url,
            supabaseKey: supabaseAnonKey,
            options: .init(auth: .init(redirectToURL: oauthRedirectURL, emitLocalSessionAsInitialSession: true))
        )
    }
}

@MainActor
final class FuelwiseSession: ObservableObject {
    @Published var auth: FuelwiseAuthService?
    @Published var api: FuelwiseAPI?
    @Published var configurationError: String?

    init() {
        do {
            let client = try FuelwiseEnvironment.makeClient()
            let auth = FuelwiseAuthService(client: client)
            self.auth = auth
            self.api = FuelwiseAPI(client: client, auth: auth)
        } catch {
            configurationError = error.localizedDescription
        }
    }
}

@MainActor
final class FuelwiseAuthService: ObservableObject {
    @Published private(set) var session: Session?
    @Published private(set) var memberId: UUID?
    @Published private(set) var isRestoring = true
    @Published var lastError: String?

    let client: SupabaseClient
    private var listenTask: Task<Void, Never>?
    private var restoreTask: Task<Void, Never>?

    init(client: SupabaseClient) {
        self.client = client
        listenTask = Task { [weak self] in await self?.listenForAuthChanges() }
        restoreTask = Task { [weak self] in await self?.restorePersistedSession() }
    }

    deinit {
        listenTask?.cancel()
        restoreTask?.cancel()
    }

    var isSignedIn: Bool { session != nil }
    var email: String? { session?.user.email }
    var displayName: String {
        let local = email?.split(separator: "@").first.map(String.init) ?? "Member"
        return local.isEmpty ? "Member" : local
    }

    func signIn(email: String, password: String) async throws {
        lastError = nil
        await applySession(try await client.auth.signIn(email: email, password: password))
    }

    func signInWithGoogle() async throws {
        lastError = nil
        await applySession(try await client.auth.signInWithOAuth(provider: .google, redirectTo: FuelwiseEnvironment.oauthRedirectURL))
    }

    func signOut() async {
        lastError = nil
        do { try await client.auth.signOut() } catch { lastError = error.localizedDescription }
        session = nil
        memberId = nil
    }

    private func listenForAuthChanges() async {
        for await (event, session) in client.auth.authStateChanges {
            switch event {
            case .initialSession:
                if let session { await applySession(session) }
                isRestoring = false
            case .signedOut:
                self.session = nil
                memberId = nil
                isRestoring = false
            case .signedIn, .tokenRefreshed, .userUpdated:
                await applySession(session)
                isRestoring = false
            default:
                break
            }
        }
    }

    private func restorePersistedSession() async {
        do { await applySession(try await client.auth.session) } catch { }
        isRestoring = false
    }

    private func applySession(_ session: Session?) async {
        self.session = session
        guard session != nil else { memberId = nil; return }
        do {
            let resolved: UUID = try await client.rpc("mobile_app_user_id").execute().value
            memberId = resolved
            lastError = nil
        } catch {
            memberId = nil
            lastError = FuelwiseError.accountNotLinked.localizedDescription
        }
    }
}
