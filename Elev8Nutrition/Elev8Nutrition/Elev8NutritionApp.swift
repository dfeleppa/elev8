import SwiftUI
import Supabase

@main
struct Elev8NutritionApp: App {
    @StateObject private var session = AppSession()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(session)
        }
    }
}

@MainActor
final class AppSession: ObservableObject {
    @Published var auth: AuthService?
    @Published var store: NutritionStore?
    @Published var configurationError: String?

    init() {
        bootstrap()
    }

    func bootstrap() {
        guard AppEnvironment.isConfigured else {
            configurationError = NutritionError.notConfigured.localizedDescription
            return
        }
        do {
            let client = try AppEnvironment.makeClient()
            let auth = AuthService(client: client)
            self.auth = auth
            self.store = NutritionStore(client: client, auth: auth)
            configurationError = nil
        } catch {
            configurationError = error.localizedDescription
        }
    }
}
