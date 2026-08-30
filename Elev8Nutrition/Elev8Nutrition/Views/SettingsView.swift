import SwiftUI

struct SettingsView: View {
    @EnvironmentObject private var auth: AuthService
    @EnvironmentObject private var store: NutritionStore

    @State private var calories = ""
    @State private var protein = ""
    @State private var carbs = ""
    @State private var fat = ""
    @State private var isWorking = false
    @State private var message: String?
    @State private var messageIsError = false

    var body: some View {
        NavigationStack {
            Form {
                Section("Account") {
                    LabeledContent("Email", value: auth.email ?? "—")
                    if let id = auth.memberId {
                        LabeledContent("Member id") {
                            Text(id.uuidString.lowercased())
                                .font(.caption.monospaced())
                                .textSelection(.enabled)
                        }
                    }
                    Button("Sign out", role: .destructive) {
                        Task { await auth.signOut() }
                    }
                }

                Section {
                    MacroField(title: "Calories", unit: "kcal", text: $calories)
                    MacroField(title: "Protein", unit: "g", text: $protein)
                    MacroField(title: "Carbs", unit: "g", text: $carbs)
                    MacroField(title: "Fat", unit: "g", text: $fat)
                    Button {
                        Task { await save() }
                    } label: {
                        HStack {
                            if isWorking { ProgressView() }
                            Text("Save targets for \(DayFormat.display(fromIso: store.selectedDayISO))")
                        }
                    }
                    .disabled(isWorking)
                } header: {
                    Text("Daily targets")
                } footer: {
                    Text("Writes calorie_target, protein_target, carbs_target, and fat_target on nutrition_days for the date selected in Today. RLS keeps rows scoped to your linked Elev8 member account.")
                }

                if let message {
                    Section {
                        Text(message)
                            .foregroundStyle(messageIsError ? AppTheme.pink : AppTheme.cyan)
                    }
                }

                Section("Database") {
                    LabeledContent("Project") {
                        Text(AppEnvironment.supabaseURLString)
                            .font(.caption)
                            .textSelection(.enabled)
                    }
                    Text("The app uses the anon key and Supabase Auth only. The service-role key stays on the server.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }
            .navigationTitle("Settings")
            .onAppear(perform: hydrate)
            .onChange(of: store.day?.id) { _, _ in hydrate() }
        }
    }

    private func hydrate() {
        calories = MacroInput.format(store.day?.calorieTarget)
        protein = MacroInput.format(store.day?.proteinTarget)
        carbs = MacroInput.format(store.day?.carbsTarget)
        fat = MacroInput.format(store.day?.fatTarget)
    }

    private func save() async {
        isWorking = true
        message = nil
        defer { isWorking = false }
        do {
            try await store.saveTargets(
                calories: MacroInput.parse(calories),
                protein: MacroInput.parse(protein),
                carbs: MacroInput.parse(carbs),
                fat: MacroInput.parse(fat)
            )
            messageIsError = false
            message = "Targets saved for \(store.selectedDayISO)."
        } catch {
            messageIsError = true
            message = error.localizedDescription
        }
    }
}
