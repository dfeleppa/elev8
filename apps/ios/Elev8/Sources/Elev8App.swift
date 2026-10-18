import SwiftUI

@main
struct Elev8App: App {
    var body: some Scene {
        WindowGroup {
            if let configuration = AppConfiguration.load() {
                SessionRoot(configuration: configuration)
            } else {
                ContentUnavailableView("Configuration needed", systemImage: "gearshape", description: Text("Supply the public staging settings in Config.local.xcconfig and rebuild."))
            }
        }
    }
}

struct SessionRoot: View {
    @StateObject private var session: AppSession
    @Environment(\.scenePhase) private var scenePhase

    init(configuration: AppConfiguration) {
        _session = StateObject(wrappedValue: AppSession(configuration: configuration))
    }

    var body: some View {
        Group {
            if let profile = session.profile {
                ExperienceView(profile: profile).id(profile.userId)
            } else {
                SignInView()
            }
        }
        .environmentObject(session)
        .task { await session.restore() }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active { Task { await session.restore() } }
        }
    }
}

struct SignInView: View {
    @EnvironmentObject private var session: AppSession
    @State private var email = ""
    @State private var password = ""

    var body: some View {
        NavigationStack {
            Form {
                Section("Your Elev8 account") {
                    TextField("Email", text: $email).textContentType(.username).keyboardType(.emailAddress).textInputAutocapitalization(.never).autocorrectionDisabled()
                    SecureField("Password", text: $password).textContentType(.password)
                }
                if let error = session.errorMessage { Text(error).foregroundStyle(.red).accessibilityAddTraits(.updatesFrequently) }
                Button(session.busy ? "Signing in…" : "Sign in") {
                    Task { await session.signIn(email: email, password: password); password = "" }
                }.disabled(session.busy || email.isEmpty || password.isEmpty)
            }.navigationTitle("Elev8")
        }
    }
}

struct ExperienceView: View {
    let profile: ClientSession
    @EnvironmentObject private var session: AppSession
    @State private var staffMode = false

    var body: some View {
        TabView {
            NavigationStack {
                List {
                    Section {
                        Text(staffMode ? "Staff workspace" : "Member workspace").font(.title2.bold())
                        Text("Signed in as \(profile.role)").foregroundStyle(.secondary)
                    }
                    if profile.hasStaffExperience {
                        Toggle("Staff experience", isOn: $staffMode)
                    }
                    Section("Foundation preview") {
                        Text(staffMode ? "Contacts are available for authorized admins and owners. Coaching, inbox, and calling are upcoming milestones." : "Use Schedule to book your next class and Profile to update your name. Training, nutrition, and gym chat are upcoming milestones.")
                    }
                    Button("Sign out", role: .destructive) { Task { await session.signOut() } }.disabled(session.busy)
                }.navigationTitle(staffMode ? "Staff" : "Today")
            }.tabItem { Label("Home", systemImage: "house") }
            if staffMode && profile.capabilities.crm {
                NavigationStack { ContactsView() }.tabItem { Label("Contacts", systemImage: "person.2") }
            }
            if !staffMode && profile.capabilities.member {
                NavigationStack { MemberScheduleView() }.tabItem { Label("Schedule", systemImage: "calendar") }
                NavigationStack { MemberProfileView() }.tabItem { Label("Profile", systemImage: "person.crop.circle") }
            }
        }
        .onChange(of: profile.hasStaffExperience) { _, allowed in if !allowed { staffMode = false } }
    }
}
