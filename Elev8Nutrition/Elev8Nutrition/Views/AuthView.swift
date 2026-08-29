import SwiftUI

struct AuthView: View {
    @EnvironmentObject private var auth: AuthService

    @State private var email = ""
    @State private var password = ""
    @State private var isSignUp = false
    @State private var isWorking = false
    @State private var message: String?
    @State private var needsConfirmation = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Elev8")
                            .font(.system(size: 18, weight: .semibold, design: .rounded))
                            .foregroundStyle(AppTheme.cyan)
                        Text(isSignUp ? "Create account" : "Welcome back")
                            .font(.system(size: 34, weight: .bold, design: .rounded))
                        Text("Sign in with the same email as the Elev8 web app. Nutrition data is scoped to your member id.")
                            .foregroundStyle(.secondary)
                    }

                    VStack(spacing: 14) {
                        TextField("Email", text: $email)
                            .textContentType(.username)
                            .keyboardType(.emailAddress)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .padding(14)
                            .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 14, style: .continuous))

                        SecureField("Password", text: $password)
                            .textContentType(isSignUp ? .newPassword : .password)
                            .padding(14)
                            .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                    }

                    if let message {
                        Text(message)
                            .font(.footnote)
                            .foregroundStyle(needsConfirmation ? AppTheme.cyan : AppTheme.pink)
                    }

                    Button(action: submit) {
                        HStack {
                            if isWorking { ProgressView().tint(.black) }
                            Text(isSignUp ? "Create account" : "Sign in")
                                .fontWeight(.semibold)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(AppTheme.cyan)
                    .foregroundStyle(.black)
                    .disabled(isWorking || email.isEmpty || password.count < 6)

                    Button(isSignUp ? "Already have an account? Sign in" : "Need an account? Sign up") {
                        isSignUp.toggle()
                        message = nil
                        needsConfirmation = false
                    }
                    .frame(maxWidth: .infinity)
                    .foregroundStyle(.secondary)
                }
                .padding(24)
            }
            .navigationBarTitleDisplayMode(.inline)
        }
    }

    private func submit() {
        isWorking = true
        message = nil
        needsConfirmation = false
        Task {
            defer { isWorking = false }
            do {
                if isSignUp {
                    let hasSession = try await auth.signUp(email: email.trimmingCharacters(in: .whitespacesAndNewlines), password: password)
                    if !hasSession {
                        needsConfirmation = true
                        message = "Check your email to confirm the account, then sign in."
                    }
                } else {
                    try await auth.signIn(email: email.trimmingCharacters(in: .whitespacesAndNewlines), password: password)
                }
            } catch {
                message = error.localizedDescription
            }
        }
    }
}
