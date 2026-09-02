import SwiftUI

struct FuelwiseAuthView: View {
    @ObservedObject var auth: FuelwiseAuthService
    @State private var email = ""
    @State private var password = ""
    @State private var isWorking = false
    @State private var message: String?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("FUELWISE").font(.caption.weight(.bold)).tracking(1.4).foregroundStyle(.indigo)
                        Text("Welcome back").font(.system(size: 34, weight: .bold, design: .rounded))
                        Text("Use the same account as Lyfe Fitness. Your existing meals, targets, and health history will appear automatically.")
                            .foregroundStyle(.secondary)
                    }

                    Button(action: signInWithGoogle) {
                        HStack(spacing: 10) {
                            Image(systemName: "g.circle.fill")
                            Text("Continue with Google").fontWeight(.semibold)
                        }
                        .frame(maxWidth: .infinity).padding(.vertical, 14)
                    }
                    .buttonStyle(.borderedProminent).tint(.indigo).disabled(isWorking)

                    HStack(spacing: 12) { Divider(); Text("or").font(.footnote).foregroundStyle(.secondary); Divider() }

                    TextField("Email", text: $email)
                        .textContentType(.username).keyboardType(.emailAddress).textInputAutocapitalization(.never).autocorrectionDisabled()
                        .padding(14).background(.thinMaterial, in: RoundedRectangle(cornerRadius: 14))
                    SecureField("Password", text: $password)
                        .textContentType(.password)
                        .padding(14).background(.thinMaterial, in: RoundedRectangle(cornerRadius: 14))

                    if let error = message ?? auth.lastError {
                        Text(error).font(.footnote).foregroundStyle(.red)
                    }

                    Button(action: signIn) {
                        HStack {
                            if isWorking { ProgressView().tint(.primary) }
                            Text("Sign in").fontWeight(.semibold)
                        }
                        .frame(maxWidth: .infinity).padding(.vertical, 14)
                    }
                    .buttonStyle(.bordered).disabled(isWorking || email.isEmpty || password.count < 6)
                }
                .padding(24)
            }
            .background(Color(.systemGroupedBackground))
        }
    }

    private func signInWithGoogle() { run { try await auth.signInWithGoogle() } }
    private func signIn() { run { try await auth.signIn(email: email.trimmingCharacters(in: .whitespacesAndNewlines), password: password) } }

    private func run(_ action: @escaping () async throws -> Void) {
        isWorking = true
        message = nil
        Task {
            defer { isWorking = false }
            do { try await action() } catch { message = error.localizedDescription }
        }
    }
}
