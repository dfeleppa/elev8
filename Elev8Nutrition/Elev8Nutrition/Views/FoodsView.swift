import SwiftUI

struct FoodsView: View {
    @EnvironmentObject private var store: NutritionStore
    @State private var query = ""
    @State private var showAdd = false
    @State private var errorMessage: String?

    private var filtered: [CustomFood] {
        store.foods(matching: query)
    }

    var body: some View {
        NavigationStack {
            List {
                if filtered.isEmpty {
                    ContentUnavailableView(
                        query.isEmpty ? "No custom foods" : "No matches",
                        systemImage: "carrot",
                        description: Text(query.isEmpty ? "Save foods you log often, then fast-log them from Today." : "Try a different name.")
                    )
                } else {
                    ForEach(filtered) { food in
                        FoodRow(food: food)
                    }
                    .onDelete(perform: delete)
                }

                if let errorMessage {
                    Text(errorMessage).foregroundStyle(AppTheme.pink)
                }
            }
            .searchable(text: $query, prompt: "Search custom foods")
            .navigationTitle("Foods")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showAdd = true
                    } label: {
                        Image(systemName: "plus.circle.fill")
                    }
                }
            }
            .sheet(isPresented: $showAdd) {
                AddFoodView()
                    .environmentObject(store)
            }
            .task { await store.refreshFoods() }
            .refreshable { await store.refreshFoods() }
        }
    }

    private func delete(at offsets: IndexSet) {
        let items = offsets.map { filtered[$0] }
        Task {
            do {
                for food in items {
                    try await store.deleteFood(food)
                }
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }
}

struct FoodRow: View {
    let food: CustomFood

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(food.name)
                .font(.headline)
            Text("\((food.calories ?? 0).wholeString) kcal  ·  P \((food.protein ?? 0).macroString)  C \((food.carbs ?? 0).macroString)  F \((food.fat ?? 0).macroString)")
                .font(.caption.monospacedDigit())
                .foregroundStyle(.secondary)
        }
        .padding(.vertical, 4)
    }
}

struct AddFoodView: View {
    @EnvironmentObject private var store: NutritionStore
    @Environment(\.dismiss) private var dismiss

    @State private var name = ""
    @State private var calories = ""
    @State private var protein = ""
    @State private var carbs = ""
    @State private var fat = ""
    @State private var isWorking = false
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            Form {
                Section("Custom food") {
                    TextField("Name", text: $name)
                    MacroField(title: "Calories", unit: "kcal", text: $calories)
                    MacroField(title: "Protein", unit: "g", text: $protein)
                    MacroField(title: "Carbs", unit: "g", text: $carbs)
                    MacroField(title: "Fat", unit: "g", text: $fat)
                }
                if let errorMessage {
                    Text(errorMessage).foregroundStyle(AppTheme.pink)
                }
            }
            .navigationTitle("Add food")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { Task { await save() } }
                        .disabled(isWorking || name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
        }
    }

    private func save() async {
        isWorking = true
        errorMessage = nil
        defer { isWorking = false }
        do {
            try await store.addFood(
                name: name,
                calories: MacroInput.parse(calories),
                protein: MacroInput.parse(protein),
                carbs: MacroInput.parse(carbs),
                fat: MacroInput.parse(fat)
            )
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
