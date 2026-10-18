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
    let id: String
    let name: String
    let classDate: String
    let classTime: String
    let durationMinutes: Int
    let reservedCount: Int
    let capacityRemaining: Int?
    let isReserved: Bool
    let isClosed: Bool

    var canBook: Bool { !isReserved && !isClosed && capacityRemaining != 0 }
    var availability: String {
        if isReserved { return "You're booked" }
        if isClosed { return "Booking closed" }
        if let remaining = capacityRemaining { return remaining == 0 ? "Class full" : "\(remaining) spots available" }
        return "Spaces available"
    }
}

struct MemberReservationResponse: Decodable { let session: MemberClass }
struct MemberReservationInput: Encodable { let classId: String; let date: String }
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
