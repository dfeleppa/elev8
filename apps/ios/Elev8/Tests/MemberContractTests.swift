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

    func testCanonicalScheduleAndBookingDecode() throws {
        let schedule = try fixture("schedule-day", as: MemberSchedule.self)
        XCTAssertEqual(schedule.timeZone, "America/New_York")
        XCTAssertTrue(schedule.sessions[0].canBook)
        XCTAssertNil(schedule.sessions[0].reservationId)
        let booked = try fixture("schedule-booked", as: MemberClass.self)
        XCTAssertEqual(booked.availabilityLabel, "You're booked")
        XCTAssertFalse(booked.canBook)
        XCTAssertTrue(booked.canCancel)
        XCTAssertNotNil(booked.reservationId)
        let unlimited = try fixture("schedule-unlimited", as: MemberClass.self)
        XCTAssertNil(unlimited.remaining)
        XCTAssertTrue(unlimited.canBook)
    }

    func testClosedAndFullClassesCannotBook() throws {
        for name in ["schedule-closed", "schedule-full"] {
            let item = try fixture(name, as: MemberClass.self)
            XCTAssertFalse(item.canBook)
        }
    }

    func testDateSelectionUsesGymDayAcrossMidnight() {
        let instant = ISO8601DateFormatter().date(from: "2026-10-18T01:00:00Z")!
        XCTAssertEqual(MemberDate.key(instant), "2026-10-17")
    }

    func testReservationPayloadNeverIncludesMemberIdentity() throws {
        let operationId = UUID()
        let body = try JSONEncoder().encode(MemberReservationInput(classId: "example", date: "2099-04-06", operationId: operationId))
        let values = try XCTUnwrap(JSONSerialization.jsonObject(with: body) as? [String: String])
        XCTAssertEqual(Set(values.keys), Set(["classId", "date", "operationId"]))
        XCTAssertEqual(values["operationId"], operationId.uuidString)
        let cancellation = try JSONEncoder().encode(MemberCancellationInput(operationId: operationId))
        let cancellationValues = try XCTUnwrap(JSONSerialization.jsonObject(with: cancellation) as? [String: String])
        XCTAssertEqual(Set(cancellationValues.keys), Set(["operationId"]))
    }
}
