import SwiftUI

enum EntryEditorMode: Identifiable {
    case add
    case edit(NutritionEntry)

    var id: String {
        switch self {
        case .add: return "add"
        case .edit(let entry): return entry.id.uuidString
        }
    }
}

struct EntryEditorView: View {
    @EnvironmentObject private var store: NutritionStore
    @Environment(\.dismiss) private var dismiss

    let mode: EntryEditorMode

    @State private var name = ""
    @State private var meal: MealType = .breakfast
    @State private var quantity = "1"
    @State private var calories = ""
    @State private var protein = ""
    @State private var carbs = ""
    @State private var fat = ""
    @State private var isWorking = false
    @State private var errorMessage: String?
    @State private var confirmDelete = false

    private var isEditing: Bool {
        if case .edit = mode { return true }
        return false
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Entry") {
                    TextField("Food name", text: $name)
                    Picker("Meal", selection: $meal) {
                        ForEach(MealType.allCases) { item in
                            Label(item.title, systemImage: item.symbol).tag(item)
                        }
                    }
                    MacroField(title: "Quantity", unit: "servings", text: $quantity)
                }

                Section("Macros") {
                    MacroField(title: "Calories", unit: "kcal", text: $calories)
                    MacroField(title: "Protein", unit: "g", text: $protein)
                    MacroField(title: "Carbs", unit: "g", text: $carbs)
                    MacroField(title: "Fat", unit: "g", text: $fat)
                }

                if isEditing {
                    Section {
                        Button("Delete entry", role: .destructive) {
                            confirmDelete = true
                        }
                    }
                }

                if let errorMessage {
                    Section {
                        Text(errorMessage).foregroundStyle(AppTheme.pink)
                    }
                }
            }
            .navigationTitle(isEditing ? "Edit entry" : "Add entry")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(isEditing ? "Save" : "Add") { Task { await save() } }
                        .disabled(isWorking || name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
            .onAppear(perform: hydrate)
            .confirmationDialog("Delete this entry?", isPresented: $confirmDelete, titleVisibility: .visible) {
                Button("Delete", role: .destructive) {
                    Task { await delete() }
                }
            }
        }
    }

    private func hydrate() {
        if case .edit(let entry) = mode {
            name = entry.entryName
            meal = entry.mealType
            quantity = MacroInput.format(entry.quantity)
            calories = MacroInput.format(entry.calories)
            protein = MacroInput.format(entry.protein)
            carbs = MacroInput.format(entry.carbs)
            fat = MacroInput.format(entry.fat)
        } else {
            meal = defaultMeal()
        }
    }

    private func defaultMeal() -> MealType {
        let hour = Calendar.current.component(.hour, from: Date())
        switch hour {
        case 0..<11: return .breakfast
        case 11..<16: return .lunch
        case 16..<21: return .dinner
        default: return .snack
        }
    }

    private func save() async {
        isWorking = true
        errorMessage = nil
        defer { isWorking = false }
        do {
            let qty = MacroInput.parse(quantity) ?? 1
            switch mode {
            case .add:
                try await store.addEntry(
                    name: name,
                    meal: meal,
                    quantity: qty,
                    calories: MacroInput.parse(calories),
                    protein: MacroInput.parse(protein),
                    carbs: MacroInput.parse(carbs),
                    fat: MacroInput.parse(fat)
                )
            case .edit(let entry):
                try await store.updateEntry(
                    entry,
                    name: name,
                    meal: meal,
                    quantity: qty,
                    calories: MacroInput.parse(calories),
                    protein: MacroInput.parse(protein),
                    carbs: MacroInput.parse(carbs),
                    fat: MacroInput.parse(fat)
                )
            }
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func delete() async {
        guard case .edit(let entry) = mode else { return }
        isWorking = true
        defer { isWorking = false }
        do {
            try await store.deleteEntry(entry)
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
