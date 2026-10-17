import XCTest
@testable import Elev8

final class ContractTests: XCTestCase {
    private func fixture<T: Decodable>(_ name: String, as type: T.Type) throws -> T {
        let url = try XCTUnwrap(Bundle(for: Self.self).url(forResource: name, withExtension: "json"))
        return try JSONDecoder().decode(type, from: Data(contentsOf: url))
    }

    func testMemberCannotSeeStaffExperience() throws {
        let member = try fixture("session-member", as: ClientSession.self)
        XCTAssertTrue(member.capabilities.member)
        XCTAssertFalse(member.hasStaffExperience)
        XCTAssertFalse(member.capabilities.crm)
    }

    func testOwnerHasBothExperiences() throws {
        let owner = try fixture("session-owner", as: ClientSession.self)
        XCTAssertTrue(owner.capabilities.member)
        XCTAssertTrue(owner.hasStaffExperience)
        XCTAssertTrue(owner.capabilities.crm)
    }

    func testContactResponseDecodesNullChannelsAndCursor() throws {
        let page = try fixture("contacts-page", as: ContactPage.self)
        XCTAssertEqual(page.contacts.first?.full_name, "Example Prospect")
        XCTAssertNil(page.contacts.first?.phone)
        XCTAssertNil(page.nextCursor)
    }
}
