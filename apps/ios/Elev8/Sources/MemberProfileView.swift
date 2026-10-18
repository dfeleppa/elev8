import SwiftUI

struct MemberProfileView: View {
    @EnvironmentObject private var session: AppSession
    @State private var profile: MemberProfile?
    @State private var fullName = ""
    @State private var loading = false
    @State private var saving = false
    @State private var message: String?
    @State private var error: String?

    var body: some View {
        Form {
            if loading { ProgressView("Loading profile…") }
            if let profile {
                Section("Your profile") {
                    TextField("Full name", text: $fullName).textContentType(.name)
                    if let email = profile.email { LabeledContent("Email", value: email) }
                    Text("Contact your gym to change your sign-in email.").font(.footnote).foregroundStyle(.secondary)
                    Button(saving ? "Saving…" : "Save name") { Task { await save() } }
                        .disabled(saving || loading || fullName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || fullName == (profile.fullName ?? ""))
                }.disabled(saving)
            }
            if let error { Section { Text(error).foregroundStyle(.red); Button("Reload profile") { Task { await load() } }.disabled(saving || loading) } }
            if let message { Text(message).accessibilityAddTraits(.updatesFrequently) }
            Section { Button("Sign out", role: .destructive) { Task { await session.signOut() } }.disabled(session.busy || saving) }
        }
        .navigationTitle("Profile")
        .task { await load() }
    }

    private func load() async {
        guard !loading && !saving else { return }
        loading = true; error = nil; message = nil
        defer { loading = false }
        do {
            let result: MemberProfile = try await session.request("api/v1/member/profile")
            guard !Task.isCancelled else { return }
            profile = result; fullName = result.fullName ?? ""
        } catch { self.error = "Profile could not be loaded. Check your connection and retry." }
    }

    private func save() async {
        guard !saving && !loading else { return }
        saving = true; error = nil; message = nil
        defer { saving = false }
        do {
            let input = MemberProfileInput(fullName: fullName.trimmingCharacters(in: .whitespacesAndNewlines))
            let result: MemberProfile = try await session.request("api/v1/member/profile", method: "PUT", body: JSONEncoder().encode(input))
            guard !Task.isCancelled else { return }
            profile = result; fullName = result.fullName ?? ""; message = "Profile saved."
        } catch { self.error = "Save could not be confirmed. Reload your profile before retrying." }
    }
}
