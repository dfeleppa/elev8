import SwiftUI

struct ContactsView: View {
    @EnvironmentObject private var session: AppSession
    @State private var contacts: [Contact] = []
    @State private var cursor: String?
    @State private var loading = false
    @State private var errorMessage: String?
    @State private var adding = false

    var body: some View {
        List {
            if let errorMessage {
                Section { Text(errorMessage).foregroundStyle(.red); Button("Retry") { Task { await load() } }.disabled(loading) }
            }
            if loading && contacts.isEmpty { ProgressView("Loading contacts") }
            if !loading && errorMessage == nil && contacts.isEmpty {
                ContentUnavailableView("No contacts yet", systemImage: "person.crop.circle.badge.plus", description: Text("Add your first prospect or customer."))
            }
            ForEach(contacts) { contact in
                VStack(alignment: .leading, spacing: 5) {
                    Text(contact.full_name).font(.headline)
                    if let email = contact.email { Text(email).foregroundStyle(.secondary) }
                    if let phone = contact.phone { Text(phone).foregroundStyle(.secondary) }
                    Text(contact.source.capitalized).font(.caption)
                }
            }
            if let cursor { Button("Load more") { Task { await load(after: cursor) } }.disabled(loading) }
        }
        .navigationTitle("Contacts")
        .toolbar { Button("Add contact", systemImage: "plus") { adding = true } }
        .task { await load() }
        .refreshable { await load() }
        .sheet(isPresented: $adding, onDismiss: { Task { await load() } }) { NewContactView() }
    }

    private func load(after: String? = nil) async {
        guard !loading else { return }
        loading = true; errorMessage = nil
        defer { loading = false }
        do {
            let page: ContactPage = try await session.request("api/v1/crm/contacts" + (after.map { "?cursor=\($0)" } ?? ""))
            if after == nil { contacts = page.contacts }
            else { contacts += page.contacts.filter { contact in !contacts.contains(where: { $0.id == contact.id }) } }
            cursor = page.nextCursor
        } catch {
            // Never leave private data visible after revoked access or failed revalidation.
            contacts = []; cursor = nil; errorMessage = error.localizedDescription
        }
    }
}

struct NewContactView: View {
    @EnvironmentObject private var session: AppSession
    @Environment(\.dismiss) private var dismiss
    @State private var id = UUID()
    @State private var name = ""
    @State private var email = ""
    @State private var phone = ""
    @State private var saving = false
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            Form {
                TextField("Name", text: $name).textContentType(.name)
                TextField("Email", text: $email).keyboardType(.emailAddress).textInputAutocapitalization(.never).autocorrectionDisabled()
                TextField("Phone with country code", text: $phone).keyboardType(.phonePad)
                Text("Provide email or phone. Use +15551234567 for phone numbers. This creates a contact, not a member account.").font(.footnote).foregroundStyle(.secondary)
                if let errorMessage { Text(errorMessage).foregroundStyle(.red) }
            }
            .disabled(saving)
            .navigationTitle("New contact")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() }.disabled(saving) }
                ToolbarItem(placement: .confirmationAction) {
                    Button(saving ? "Saving…" : "Save") { Task { await save() } }
                        .disabled(saving || name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || (email.isEmpty && phone.isEmpty))
                }
            }
            .interactiveDismissDisabled(saving)
        }
    }

    private func save() async {
        guard !saving else { return }
        saving = true; errorMessage = nil
        defer { saving = false }
        do {
            let input = NewContact(id: id, full_name: name, email: email, phone: phone)
            let _: ContactResult = try await session.request("api/v1/crm/contacts", method: "POST", body: JSONEncoder().encode(input))
            dismiss()
        } catch let error as APIError where error.status == 409 { dismiss() }
        catch { errorMessage = error.localizedDescription }
    }
}
