import Foundation

struct MemberProfile: Decodable {
    let fullName: String?
    let email: String?
    let createdAt: String?
}

struct MemberSchedule: Decodable {
    let date: String
    let timeZone: String
    let sessions: [MemberClass]
}

struct MemberClass: Decodable, Identifiable {
    let classId: String
    var id: String { classId }
    let name: String
    let date: String
    let timeZone: String
    let startsAt: String?
    let durationMinutes: Int
    let reservedCount: Int
    let remaining: Int?
    let reservationId: String?
    let availability: String
    let canBook: Bool
    let canCancel: Bool

    var isReserved: Bool { reservationId != nil }
    var classTime: String {
        guard let startsAt else { return "Time unavailable" }
        let parser = ISO8601DateFormatter()
        parser.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let fractional = parser.date(from: startsAt)
        parser.formatOptions = [.withInternetDateTime]
        guard let instant = fractional ?? parser.date(from: startsAt) else { return "Time unavailable" }
        let formatter = DateFormatter()
        formatter.timeZone = TimeZone(identifier: timeZone) ?? MemberDate.gymTimeZone
        formatter.dateStyle = .none
        formatter.timeStyle = .short
        return formatter.string(from: instant)
    }
    var availabilityLabel: String {
        if isReserved { return "You're booked" }
        if availability == "invalid_time" { return "Class time needs correction" }
        if availability == "closed" { return "Booking closed" }
        if availability == "full" { return "Class full" }
        if let remaining { return remaining == 0 ? "Class full" : "\(remaining) spots available" }
        return "Spaces available"
    }
}

struct MemberReservationResponse: Decodable { let code: String; let session: MemberClass? }
struct MemberReservationInput: Encodable { let classId: String; let date: String; let operationId: UUID }
struct MemberCancellationInput: Encodable { let operationId: UUID }
struct MemberProfileInput: Encodable { let fullName: String }

enum MemberDate {
    static let gymTimeZone = TimeZone(identifier: "America/New_York")!
    static func key(_ date: Date) -> String {
        let format = DateFormatter()
        format.locale = Locale(identifier: "en_US_POSIX")
        format.timeZone = gymTimeZone
        format.dateFormat = "yyyy-MM-dd"
        return format.string(from: date)
    }
}
