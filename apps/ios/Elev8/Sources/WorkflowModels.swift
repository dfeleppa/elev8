import Foundation

struct CRMContact: Decodable {
    let id: UUID
    let full_name: String
    let email: String?
    let phone: String?
    let source: String
    let owner_id: UUID?
    let version: Int
}
struct CRMStaff: Decodable, Identifiable { let id: UUID; let name: String? }
struct CRMNote: Decodable, Identifiable { let id: UUID; let body: String; let created_at: String }
struct CRMOpportunity: Decodable, Identifiable {
    let id: UUID; let title: String; let stage: String; let owner_id: UUID?
    let value_cents: Int; let currency: String; let next_action: String; let version: Int
}
struct CRMTask: Decodable, Identifiable {
    let id: UUID; let title: String; let assignee_id: UUID?; let opportunity_id: UUID?
    let due_at: String; let completed: Bool; let version: Int
}
struct CRMStageEvent: Decodable, Identifiable {
    let id: UUID; let opportunity_id: UUID; let from_stage: String?; let to_stage: String; let created_at: String
}
struct CRMDetail: Decodable {
    let contact: CRMContact; let staff: [CRMStaff]; let notes: [CRMNote]
    let opportunities: [CRMOpportunity]; let tasks: [CRMTask]; let stage_events: [CRMStageEvent]; let truncated: Bool
}
struct CRMSaved: Decodable { let saved: Bool }
let crmStages = ["new", "contacted", "consultation", "trial", "won", "lost"]
