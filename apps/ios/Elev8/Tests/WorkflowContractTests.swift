import XCTest
@testable import Elev8

final class WorkflowContractTests: XCTestCase {
    func testContactWorkflowContractDecodes() throws {
        let url = try XCTUnwrap(Bundle(for: Self.self).url(forResource: "contact-workflow-detail", withExtension: "json"))
        let detail = try JSONDecoder().decode(CRMDetail.self, from: Data(contentsOf: url))
        XCTAssertEqual(detail.contact.version, 2)
        XCTAssertNil(detail.contact.owner_id)
        XCTAssertEqual(detail.opportunities.first?.value_cents, 15000)
        XCTAssertEqual(detail.opportunities.first?.stage, "trial")
        XCTAssertEqual(detail.tasks.first?.opportunity_id, detail.opportunities.first?.id)
        XCTAssertFalse(detail.tasks.first?.completed ?? true)
        XCTAssertEqual(detail.stage_events.first?.from_stage, "new")
    }
}
