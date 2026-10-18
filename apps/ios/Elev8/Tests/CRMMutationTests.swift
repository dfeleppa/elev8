import XCTest
@testable import Elev8

@MainActor
final class CRMMutationTests: XCTestCase {
    private func fixture() throws -> CRMDetail {
        let url = try XCTUnwrap(Bundle(for: Self.self).url(forResource: "contact-detail", withExtension: "json"))
        return try JSONDecoder().decode(CRMDetail.self, from: Data(contentsOf: url))
    }

    func testLostResponseConflictAndReadFailureKeepOperationAndUnrelatedDrafts() async throws {
        var note = CRMCreationAttempt()
        let task = CRMCreationAttempt(), opportunity = CRMCreationAttempt()
        let original = note.id, taskID = task.id, opportunityID = opportunity.id
        let lost = await performCRMMutation(send: { throw URLError(.networkConnectionLost) }, refresh: { XCTFail("No acknowledged write") }, reconciled: { false })
        note.finish(acknowledged: lost.acknowledged)
        XCTAssertEqual(note.id, original)
        let conflict = await performCRMMutation(send: { throw APIError(status: 409, message: "Already saved") }, refresh: { throw URLError(.notConnectedToInternet) }, reconciled: { false })
        note.finish(acknowledged: conflict.acknowledged)
        XCTAssertEqual(note.id, original)
        let retry = await performCRMMutation(send: { throw APIError(status: 409, message: "Already saved") }, refresh: {}, reconciled: { false })
        note.finish(acknowledged: retry.acknowledged)
        XCTAssertEqual(note.id, original)
        XCTAssertEqual(task.id, taskID)
        XCTAssertEqual(opportunity.id, opportunityID)
    }

    func testAcknowledgedPostRemainsSuccessfulWhenRefreshFails() async {
        var note = CRMCreationAttempt()
        let task = CRMCreationAttempt(), opportunity = CRMCreationAttempt()
        let original = note.id, taskID = task.id, opportunityID = opportunity.id
        var posts = 0
        let result = await performCRMMutation(send: { posts += 1 }, refresh: { throw URLError(.notConnectedToInternet) }, reconciled: { false })
        XCTAssertTrue(result.acknowledged)
        XCTAssertNotNil(result.error)
        note.finish(acknowledged: result.acknowledged)
        XCTAssertNotEqual(note.id, original)
        XCTAssertEqual(posts, 1)
        XCTAssertEqual(task.id, taskID)
        XCTAssertEqual(opportunity.id, opportunityID)
    }

    func testConflictNeedsMatchingPersistedRecordBeforeRotatingOperation() async throws {
        let detail = try fixture()
        let persisted = try XCTUnwrap(detail.notes.first)
        let matching: [String: Any] = ["action": "note", "id": persisted.id.uuidString, "body": persisted.body]
        let different: [String: Any] = ["action": "note", "id": persisted.id.uuidString, "body": "Different draft"]
        XCTAssertTrue(detail.matchesCreation(matching))
        XCTAssertFalse(detail.matchesCreation(different))
        let wrong = await performCRMMutation(send: { throw APIError(status: 409, message: "Conflict") }, refresh: {}, reconciled: { detail.matchesCreation(different) })
        XCTAssertFalse(wrong.acknowledged)
        let recovered = await performCRMMutation(send: { throw APIError(status: 409, message: "Conflict") }, refresh: {}, reconciled: { detail.matchesCreation(matching) })
        XCTAssertTrue(recovered.acknowledged)
        XCTAssertNil(recovered.error)
    }
}
