import XCTest
@testable import Elev8

final class MemberContractTests: XCTestCase {
    private func fixture<T: Decodable>(_ name: String, as type: T.Type) throws -> T {
        let url = try XCTUnwrap(Bundle(for: Self.self).url(forResource: name, withExtension: "json"))
        return try JSONDecoder().decode(type, from: Data(contentsOf: url))
    }

    func testOwnProfileDecodes() throws {
        let profile = try fixture("member-profile", as: MemberProfile.self)
        XCTAssertEqual(profile.fullName, "Example Member")
        XCTAssertEqual(profile.email, "member@example.invalid")
    }

    func testBookedAndUnlimitedClassesDecode() throws {
        let schedule = try fixture("member-schedule", as: MemberSchedule.self)
        XCTAssertEqual(schedule.timeZone, "America/New_York")
        XCTAssertEqual(schedule.sessions[0].availability, "You're booked")
        XCTAssertFalse(schedule.sessions[0].canBook)
        XCTAssertNil(schedule.sessions[1].capacityRemaining)
        XCTAssertTrue(schedule.sessions[1].canBook)
    }

    func testClosedAndFullClassesCannotBook() throws {
        for status in ["\"capacityRemaining\":0,\"isClosed\":false", "\"capacityRemaining\":2,\"isClosed\":true"] {
            let json = "{\"id\":\"class\",\"name\":\"Strength\",\"classDate\":\"2099-04-06\",\"classTime\":\"09:00:00\",\"durationMinutes\":60,\"reservedCount\":2,\"isReserved\":false,\(status)}"
            let item = try JSONDecoder().decode(MemberClass.self, from: Data(json.utf8))
            XCTAssertFalse(item.canBook)
        }
    }

    func testDateSelectionUsesGymDayAcrossMidnight() {
        let instant = ISO8601DateFormatter().date(from: "2026-10-18T01:00:00Z")!
        XCTAssertEqual(MemberDate.key(instant), "2026-10-17")
    }

    func testReservationPayloadNeverIncludesMemberIdentity() throws {
        let body = try JSONEncoder().encode(MemberReservationInput(classId: "example", date: "2099-04-06"))
        let values = try XCTUnwrap(JSONSerialization.jsonObject(with: body) as? [String: String])
        XCTAssertEqual(Set(values.keys), Set(["classId", "date"]))
    }
}
