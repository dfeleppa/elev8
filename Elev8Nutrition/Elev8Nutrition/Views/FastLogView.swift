import SwiftUI

struct FastLogView: View {
    @EnvironmentObject private var store: NutritionStore
    @Environment(\.dismiss) private var dismiss

    @State private var query = ""
    @State private var selected: CustomFood?
    @State private var meal: MealType = .lunch
    @State private var quantity = "1"
    @State private var isWorking = false
    @State private var errorMessage: String?

    private var matches: [CustomFood] {
        store.foods(matching: query)
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                if let selected {
                    confirmPane(selected)
                } else {
                    searchPane
                }
            }
            .navigationTitle("Fast log")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { dismiss() }
                }
            }
            .task { await store.refreshFoods() }
            .onAppear { meal = defaultMeal() }
        }
    }

    private var searchPane: some View {
        List {
            Section {
                TextField("Search custom foods", text: $query)
                    .textInputAutocapitalization(.never)
            }
            Section("Foods") {
                if matches.isEmpty {
                    Text(store.foods.isEmpty ? "Add foods first in the Foods tab." : "No matches.")
                        .foregroundStyle(.secondary)
                } else {
                    ForEach(matches) { food in
                        Button {
                            selected = food
                        } label: {
                            FoodRow(food: food)
                        }
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
    }

    private func confirmPane(_ food: CustomFood) -> some View {
        Form {
            Section("Food") {
                Text(food.name).font(.headline)
                Button("Choose a different food") { selected = nil }
            }
            Section("Log to \(DayFormat.display(fromIso: store.selectedDayISO))") {
                Picker("Meal", selection: $meal) {
                    ForEach(MealType.allCases) { item in
                        Label(item.title, systemImage: item.symbol).tag(item)
                    }
                }
                MacroField(title: "Quantity", unit: "servings", text: $quantity)
                let qty = MacroInput.parse(quantity) ?? 1
                let scaled = food.scaled(by: qty)
                Text("\(scaled.calories.wholeString) kcal  ·  P \(scaled.protein.macroString)  C \(scaled.carbs.macroString)  F \(scaled.fat.macroString)")
                    .font(.subheadline.monospacedDigit())
                    .foregroundStyle(.secondary)
            }
            if let errorMessage {
                Text(errorMessage).foregroundStyle(AppTheme.pink)
            }
            Section {
                Button {
                    Task { await log(food) }
                } label: {
                    HStack {
                        if isWorking { ProgressView() }
                        Text("Log \(meal.title.lowercased())")
                            .fontWeight(.semibold)
                    }
                    .frame(maxWidth: .infinity)
                }
                .disabled(isWorking)
            }
        }
    }

    private func log(_ food: CustomFood) async {
        isWorking = true
        errorMessage = nil
        defer { isWorking = false }
        do {
            try await store.logFood(food, meal: meal, quantity: MacroInput.parse(quantity) ?? 1)
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
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
}
