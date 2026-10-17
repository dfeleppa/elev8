import Foundation

struct ClientCapabilities: Codable {
    let member: Bool
    let coaching: Bool
    let crm: Bool
}

struct ClientSession: Codable {
    let userId: UUID
    let role: String
    let capabilities: ClientCapabilities
    var hasStaffExperience: Bool { capabilities.crm || capabilities.coaching }
}

struct Contact: Codable, Identifiable {
    let id: UUID
    let full_name: String
    let email: String?
    let phone: String?
    let source: String
    let created_at: String
}

struct ContactPage: Codable {
    let contacts: [Contact]
    let nextCursor: String?
}

struct NewContact: Encodable {
    let id: UUID
    let full_name: String
    let email: String
    let phone: String
    let source = "manual"
}

struct ContactResult: Decodable { let contact: Contact }
struct APIErrorBody: Decodable { let error: String }

struct APIError: LocalizedError {
    let status: Int
    let message: String
    var errorDescription: String? { message }
}

struct AppConfiguration {
    let apiURL: URL
    let supabaseURL: URL
    let publicKey: String

    static func load() -> AppConfiguration? {
        let info = Bundle.main.infoDictionary ?? [:]
        guard let api = info["ELEV8_API_URL"] as? String,
              let supabase = info["SUPABASE_URL"] as? String,
              let key = info["SUPABASE_PUBLIC_KEY"] as? String,
              ![api, supabase, key].contains(where: { $0.isEmpty || $0.contains("YOUR_") || $0.contains("$(") }),
              let apiURL = URL(string: api), apiURL.scheme == "https", apiURL.host != nil,
              let supabaseURL = URL(string: supabase), supabaseURL.scheme == "https", supabaseURL.host != nil
        else { return nil }
        return AppConfiguration(apiURL: apiURL, supabaseURL: supabaseURL, publicKey: key)
    }
}
