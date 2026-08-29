import Foundation
import Supabase

enum AppEnvironment {
    static var supabaseURLString: String {
        (Bundle.main.object(forInfoDictionaryKey: "SUPABASE_URL") as? String)?
            .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    }

    static var supabaseAnonKey: String {
        (Bundle.main.object(forInfoDictionaryKey: "SUPABASE_ANON_KEY") as? String)?
            .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    }

    static var isConfigured: Bool {
        let url = supabaseURLString
        let key = supabaseAnonKey
        return url.hasPrefix("https://")
            && !url.contains("YOUR-PROJECT")
            && key.count >= 20
            && !key.contains("YOUR_SUPABASE_ANON_KEY")
    }

    static func makeClient() throws -> SupabaseClient {
        guard isConfigured, let url = URL(string: supabaseURLString) else {
            throw NutritionError.notConfigured
        }
        return SupabaseClient(
            supabaseURL: url,
            supabaseKey: supabaseAnonKey,
            options: SupabaseClientOptions(
                auth: .init(emitLocalSessionAsInitialSession: true)
            )
        )
    }
}
