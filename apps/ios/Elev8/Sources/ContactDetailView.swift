import SwiftUI

struct ContactDetailView: View {
    @EnvironmentObject private var session: AppSession
    let id: UUID
    @State private var detail: CRMDetail?
    @State private var errorMessage: String?
    @State private var busy = false
    @State private var name = ""
    @State private var email = ""
    @State private var phone = ""
    @State private var owner = ""
    @State private var note = ""
    @State private var title = ""
    @State private var nextAction = ""
    @State private var opportunityOwner = ""
    @State private var value = "0"
    @State private var taskTitle = ""
    @State private var assignee = ""
    @State private var opportunity = ""
    @State private var due = Date()
    @State private var noteAttempt = CRMCreationAttempt()
    @State private var opportunityAttempt = CRMCreationAttempt()
    @State private var taskAttempt = CRMCreationAttempt()

    private var path: String { "api/v1/crm/contacts/\(id.uuidString)" }
    var body: some View {
        Form {
            if let errorMessage { Section { Text(errorMessage).foregroundStyle(.red); Button("Refresh") { Task { await load() } } } }
            if let detail {
                if detail.truncated { Text("Showing up to 100 items per section; older records may be omitted.").font(.footnote) }
                Section("Contact details") {
                    TextField("Name", text: $name)
                    TextField("Email", text: $email).keyboardType(.emailAddress).textInputAutocapitalization(.never)
                    TextField("International phone", text: $phone).keyboardType(.phonePad)
                    staffPicker("Owner", selection: $owner, staff: detail.staff)
                    Text("Source: \(detail.contact.source)")
                    Button("Save details") { Task {
                        await mutate(["id": id.uuidString, "full_name": name, "email": email, "phone": phone, "source": detail.contact.source, "owner_id": nullable(owner), "expected_version": detail.contact.version], edit: true)
                    } }
                }
                Section("Staff notes") {
                    TextField("Add a note", text: $note, axis: .vertical)
                    Button("Save note") { Task {
                        let acknowledged = await mutate(["action": "note", "id": noteAttempt.id.uuidString, "body": note])
                        noteAttempt.finish(acknowledged: acknowledged)
                        if acknowledged { note = "" }
                    } }.disabled(note.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    ForEach(detail.notes) { n in VStack(alignment: .leading) { Text(n.body); Text(n.created_at).font(.caption).foregroundStyle(.secondary) } }
                }
                Section("Opportunities") {
                    ForEach(detail.opportunities) { o in
                        VStack(alignment: .leading) {
                            Text(o.title).font(.headline)
                            Text("\(o.value_cents, format: .number) USD cents · \(o.next_action)").font(.caption)
                            Picker("Stage", selection: Binding(get: { o.stage }, set: { stage in Task { await mutate(["action": "stage", "id": o.id.uuidString, "stage": stage, "expected_version": o.version]) } })) {
                                ForEach(crmStages, id: \.self) { Text($0.capitalized).tag($0) }
                            }
                            Text("Assigned: \(detail.staff.first(where: { $0.id == o.owner_id })?.name ?? "Unassigned")").font(.caption)
                        }
                    }
                    TextField("New opportunity", text: $title)
                    staffPicker("Assigned staff", selection: $opportunityOwner, staff: detail.staff)
                    TextField("Value in USD cents", text: $value).keyboardType(.numberPad)
                    TextField("Next action", text: $nextAction)
                    Button("Add opportunity") { Task {
                        let acknowledged = await mutate(["action": "opportunity", "id": opportunityAttempt.id.uuidString, "title": title, "owner_id": nullable(opportunityOwner), "value_cents": Int(value) ?? -1, "next_action": nextAction])
                        opportunityAttempt.finish(acknowledged: acknowledged)
                        if acknowledged { title = ""; nextAction = "" }
                    } }.disabled(title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
                Section("Follow-up tasks") {
                    ForEach(detail.tasks) { t in
                        VStack(alignment: .leading) {
                            Button { Task { await mutate(["action": "task_status", "id": t.id.uuidString, "completed": !t.completed, "expected_version": t.version]) } } label: {
                                Label(t.title, systemImage: t.completed ? "checkmark.circle.fill" : "circle")
                            }
                            Text(t.due_at).font(.caption)
                            Text(detail.staff.first(where: { $0.id == t.assignee_id })?.name ?? "Unassigned").font(.caption)
                        }
                    }
                    TextField("Follow-up", text: $taskTitle)
                    DatePicker("Due", selection: $due)
                    staffPicker("Responsible staff", selection: $assignee, staff: detail.staff)
                    Picker("Opportunity", selection: $opportunity) {
                        Text("Contact only").tag("")
                        ForEach(detail.opportunities) { Text($0.title).tag($0.id.uuidString) }
                    }
                    Button("Add follow-up") { Task {
                        let acknowledged = await mutate(["action": "task", "id": taskAttempt.id.uuidString, "title": taskTitle, "assignee_id": nullable(assignee), "opportunity_id": nullable(opportunity), "due_at": ISO8601DateFormatter().string(from: due)])
                        taskAttempt.finish(acknowledged: acknowledged)
                        if acknowledged { taskTitle = "" }
                    } }.disabled(taskTitle.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
                Section("Stage history") {
                    ForEach(detail.stage_events) { event in
                        Text("\(event.from_stage ?? "Created") → \(event.to_stage) · \(event.created_at)").font(.caption)
                    }
                }
            } else if busy { ProgressView("Loading contact") }
        }
        .disabled(busy)
        .navigationTitle("Contact")
        .task { await load() }
        .refreshable { await load() }
    }
    private func nullable(_ value: String) -> Any { value.isEmpty ? NSNull() : value as Any }
    private func staffPicker(_ label: String, selection: Binding<String>, staff: [CRMStaff]) -> some View {
        Picker(label, selection: selection) {
            Text("Unassigned").tag("")
            ForEach(staff) { Text($0.name ?? $0.id.uuidString).tag($0.id.uuidString) }
        }
    }
    private func read() async throws {
        let result: CRMDetail = try await session.request(path + "/workflow")
        detail = result; name = result.contact.full_name; email = result.contact.email ?? ""
        phone = result.contact.phone ?? ""; owner = result.contact.owner_id?.uuidString ?? ""
    }
    private func load() async {
        guard !busy else { return }; busy = true; errorMessage = nil
        defer { busy = false }
        do { try await read() } catch { detail = nil; errorMessage = error.localizedDescription }
    }
    @discardableResult private func mutate(_ values: [String: Any], edit: Bool = false) async -> Bool {
        guard !busy else { return false }; busy = true; errorMessage = nil
        defer { busy = false }
        let result = await performCRMMutation(send: {
            let _: CRMSaved = try await session.request(path + "/workflow", method: edit ? "PATCH" : "POST", body: JSONSerialization.data(withJSONObject: values))
        }, refresh: {
            try await read()
        }, reconciled: {
            !edit && (detail?.matchesCreation(values) ?? false)
        })
        if let error = result.error {
            if let api = error as? APIError, api.status == 401 || api.status == 403 { detail = nil }
            errorMessage = result.acknowledged
                ? "Saved. The updated contact could not be refreshed. Refresh to see the saved record."
                : error.localizedDescription
        }
        return result.acknowledged
    }
}
