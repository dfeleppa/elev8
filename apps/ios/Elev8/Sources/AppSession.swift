import Foundation
import Combine
import Supabase

@MainActor
final class AppSession: ObservableObject {
    @Published private(set) var profile: ClientSession?
    @Published private(set) var busy = false
    @Published var errorMessage: String?
    private let client: SupabaseClient
    private let apiURL: URL

    init(configuration: AppConfiguration) {
        client = SupabaseClient(supabaseURL: configuration.supabaseURL, supabaseKey: configuration.publicKey)
        apiURL = configuration.apiURL
    }

    func restore() async {
        guard !busy else { return }
        busy = true
        defer { busy = false }
        guard client.auth.currentSession != nil else { profile = nil; return }
        do {
            profile = try await request("api/v1/session")
            errorMessage = nil
        } catch {
            profile = nil
            errorMessage = "Please sign in again. Your session or account access could not be verified."
        }
    }

    func signIn(email: String, password: String) async {
        guard !busy else { return }
        busy = true; errorMessage = nil
        defer { busy = false }
        do {
            _ = try await client.auth.signIn(email: email.trimmingCharacters(in: .whitespacesAndNewlines), password: password)
            profile = try await request("api/v1/session")
        } catch {
            profile = nil
            try? await client.auth.signOut(scope: .local)
            errorMessage = "Sign-in failed. Check your credentials and that your account is linked to Elev8."
        }
    }

    func signOut() async {
        guard !busy else { return }
        busy = true
        profile = nil
        defer { busy = false }
        do { try await client.auth.signOut(scope: .local); errorMessage = nil }
        catch { errorMessage = "You have been signed out locally. The server could not confirm sign-out." }
    }

    func request<T: Decodable>(_ path: String, method: String = "GET", body: Data? = nil) async throws -> T {
        let session = try await client.auth.session
        guard let url = URL(string: path, relativeTo: apiURL.appendingPathComponent("/")) else {
            throw APIError(status: 0, message: "Invalid service address.")
        }
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.httpBody = body
        request.cachePolicy = .reloadIgnoringLocalCacheData
        request.setValue("Bearer \(session.accessToken)", forHTTPHeaderField: "Authorization")
        if body != nil { request.setValue("application/json", forHTTPHeaderField: "Content-Type") }
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw APIError(status: 0, message: "No server response.") }
        guard (200...299).contains(http.statusCode) else {
            if http.statusCode == 401 { profile = nil }
            let message = (try? JSONDecoder().decode(APIErrorBody.self, from: data).error) ?? "The request could not be completed."
            throw APIError(status: http.statusCode, message: message)
        }
        return try JSONDecoder().decode(T.self, from: data)
    }
}
