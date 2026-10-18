import Foundation

struct CRMMutationResult {
    let acknowledged: Bool
    let error: Error?
}

struct CRMCreationAttempt {
    private(set) var id = UUID()
    mutating func finish(acknowledged: Bool) {
        if acknowledged { id = UUID() }
    }
}

/// Keeps POST acknowledgement separate from refreshing the display. Only an
/// acknowledgement (or a matching persisted creation) permits rotating its UUID.
@MainActor
func performCRMMutation(
    send: () async throws -> Void,
    refresh: () async throws -> Void,
    reconciled: () -> Bool
) async -> CRMMutationResult {
    do { try await send() }
    catch {
        let sendError = error
        if let api = error as? APIError, api.status == 409 {
            do {
                try await refresh()
                if reconciled() { return CRMMutationResult(acknowledged: true, error: nil) }
            } catch { return CRMMutationResult(acknowledged: false, error: error) }
        }
        return CRMMutationResult(acknowledged: false, error: sendError)
    }
    do {
        try await refresh()
        return CRMMutationResult(acknowledged: true, error: nil)
    } catch { return CRMMutationResult(acknowledged: true, error: error) }
}

extension CRMDetail {
    func matchesCreation(_ values: [String: Any]) -> Bool {
        guard let idString = values["id"] as? String, let id = UUID(uuidString: idString) else { return false }
        func text(_ key: String) -> String { (values[key] as? String ?? "").trimmingCharacters(in: .whitespacesAndNewlines) }
        func uuid(_ key: String) -> UUID? { (values[key] as? String).flatMap(UUID.init(uuidString:)) }
        switch values["action"] as? String {
        case "note": return notes.contains { $0.id == id && $0.body == text("body") }
        case "opportunity": return opportunities.contains {
            $0.id == id && $0.title == text("title") && $0.owner_id == uuid("owner_id") &&
            $0.value_cents == (values["value_cents"] as? Int) && $0.next_action == text("next_action")
        }
        case "task": return tasks.contains {
            $0.id == id && $0.title == text("title") && $0.assignee_id == uuid("assignee_id") &&
            $0.opportunity_id == uuid("opportunity_id") && crmTimestamp($0.due_at) != nil && crmTimestamp($0.due_at) == crmTimestamp(text("due_at"))
        }
        default: return false
        }
    }
}

private func crmTimestamp(_ value: String) -> Date? {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return formatter.date(from: value) ?? ISO8601DateFormatter().date(from: value)
}
