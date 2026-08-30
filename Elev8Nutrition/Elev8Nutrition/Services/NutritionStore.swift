import Foundation
import Supabase

@MainActor
final class NutritionStore: ObservableObject {
    @Published var selectedDate: Date = Date()
    @Published var day: NutritionDay?
    @Published var entries: [NutritionEntry] = []
    @Published var foods: [CustomFood] = []
    @Published var isLoadingDay = false
    @Published var isLoadingFoods = false
    @Published var errorMessage: String?

    private let client: SupabaseClient
    private let auth: AuthService

    private let dayColumns = "id, member_id, day_date, calorie_target, protein_target, carbs_target, fat_target, created_at, updated_at"
    private let entryColumns = "id, day_id, member_id, meal_type, entry_name, quantity, calories, protein, carbs, fat, created_at, updated_at"
    private let foodColumns = "id, member_id, name, calories, protein, carbs, fat, created_at, updated_at"

    init(client: SupabaseClient, auth: AuthService) {
        self.client = client
        self.auth = auth
    }

    var selectedDayISO: String { DayFormat.isoDay(from: selectedDate) }

    var totals: MacroTotals { entries.totals }

    var remaining: MacroTotals {
        MacroTotals(
            calories: (day?.calorieTarget ?? 0) - totals.calories,
            protein: (day?.proteinTarget ?? 0) - totals.protein,
            carbs: (day?.carbsTarget ?? 0) - totals.carbs,
            fat: (day?.fatTarget ?? 0) - totals.fat
        )
    }

    func shiftDay(by days: Int) {
        selectedDate = Calendar.current.date(byAdding: .day, value: days, to: selectedDate) ?? selectedDate
        Task { await refreshDay() }
    }

    func jumpToToday() {
        selectedDate = Date()
        Task { await refreshDay() }
    }

    func refreshAll() async {
        await withTaskGroup(of: Void.self) { group in
            group.addTask { await self.refreshDay() }
            group.addTask { await self.refreshFoods() }
        }
    }

    func refreshDay() async {
        guard let memberId = auth.memberId else { return }
        isLoadingDay = true
        errorMessage = nil
        defer { isLoadingDay = false }

        do {
            let dayRows: [NutritionDay] = try await client
                .from("nutrition_days")
                .select(dayColumns)
                .eq("member_id", value: memberId)
                .eq("day_date", value: selectedDayISO)
                .limit(1)
                .execute()
                .value

            day = dayRows.first

            if let dayId = day?.id {
                let loaded: [NutritionEntry] = try await client
                    .from("nutrition_entries")
                    .select(entryColumns)
                    .eq("member_id", value: memberId)
                    .eq("day_id", value: dayId)
                    .order("created_at", ascending: true)
                    .execute()
                    .value
                entries = loaded
            } else {
                entries = []
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func refreshFoods() async {
        guard let memberId = auth.memberId else { return }
        isLoadingFoods = true
        defer { isLoadingFoods = false }

        do {
            let loaded: [CustomFood] = try await client
                .from("nutrition_custom_foods")
                .select(foodColumns)
                .eq("member_id", value: memberId)
                .order("created_at", ascending: false)
                .execute()
                .value
            foods = loaded
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func foods(matching query: String) -> [CustomFood] {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return foods }
        return foods.filter { $0.name.localizedCaseInsensitiveContains(trimmed) }
    }

    @discardableResult
    func ensureDay() async throws -> NutritionDay {
        if let day { return day }
        guard let memberId = auth.memberId else { throw NutritionError.notSignedIn }

        let inserted: NutritionDay = try await client
            .from("nutrition_days")
            .upsert(
                NutritionDayInsert(
                    memberId: memberId,
                    dayDate: selectedDayISO,
                    calorieTarget: nil,
                    proteinTarget: nil,
                    carbsTarget: nil,
                    fatTarget: nil
                ),
                onConflict: "member_id,day_date"
            )
            .select(dayColumns)
            .single()
            .execute()
            .value

        day = inserted
        return inserted
    }

    func saveTargets(calories: Double?, protein: Double?, carbs: Double?, fat: Double?) async throws {
        guard let memberId = auth.memberId else { throw NutritionError.notSignedIn }

        let updated: NutritionDay = try await client
            .from("nutrition_days")
            .upsert(
                NutritionDayTargetUpdate(
                    memberId: memberId,
                    dayDate: selectedDayISO,
                    calorieTarget: calories,
                    proteinTarget: protein,
                    carbsTarget: carbs,
                    fatTarget: fat
                ),
                onConflict: "member_id,day_date"
            )
            .select(dayColumns)
            .single()
            .execute()
            .value

        day = updated
    }

    func addEntry(
        name: String,
        meal: MealType,
        quantity: Double,
        calories: Double?,
        protein: Double?,
        carbs: Double?,
        fat: Double?
    ) async throws {
        guard let memberId = auth.memberId else { throw NutritionError.notSignedIn }
        let day = try await ensureDay()
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { throw NutritionError.message("Food name is required.") }

        let inserted: NutritionEntry = try await client
            .from("nutrition_entries")
            .insert(
                NutritionEntryInsert(
                    memberId: memberId,
                    dayId: day.id,
                    mealType: meal.rawValue,
                    entryName: trimmed,
                    quantity: max(0.01, quantity),
                    calories: calories,
                    protein: protein,
                    carbs: carbs,
                    fat: fat
                )
            )
            .select(entryColumns)
            .single()
            .execute()
            .value

        entries.append(inserted)
        entries.sort { ($0.createdAt ?? .distantPast) < ($1.createdAt ?? .distantPast) }
    }

    func logFood(_ food: CustomFood, meal: MealType, quantity: Double) async throws {
        let scaled = food.scaled(by: quantity)
        try await addEntry(
            name: food.name,
            meal: meal,
            quantity: quantity,
            calories: food.calories == nil ? nil : scaled.calories,
            protein: food.protein == nil ? nil : scaled.protein,
            carbs: food.carbs == nil ? nil : scaled.carbs,
            fat: food.fat == nil ? nil : scaled.fat
        )
    }

    func updateEntry(
        _ entry: NutritionEntry,
        name: String,
        meal: MealType,
        quantity: Double,
        calories: Double?,
        protein: Double?,
        carbs: Double?,
        fat: Double?
    ) async throws {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { throw NutritionError.message("Food name is required.") }

        guard let memberId = auth.memberId else { throw NutritionError.notSignedIn }
        let updated: NutritionEntry = try await client
            .from("nutrition_entries")
            .update(
                NutritionEntryUpdate(
                    mealType: meal.rawValue,
                    entryName: trimmed,
                    quantity: max(0.01, quantity),
                    calories: calories,
                    protein: protein,
                    carbs: carbs,
                    fat: fat
                )
            )
            .eq("id", value: entry.id)
            .eq("member_id", value: memberId)
            .select(entryColumns)
            .single()
            .execute()
            .value

        if let index = entries.firstIndex(where: { $0.id == entry.id }) {
            entries[index] = updated
        }
    }

    func deleteEntry(_ entry: NutritionEntry) async throws {
        guard let memberId = auth.memberId else { throw NutritionError.notSignedIn }
        try await client
            .from("nutrition_entries")
            .delete()
            .eq("id", value: entry.id)
            .eq("member_id", value: memberId)
            .execute()
        entries.removeAll { $0.id == entry.id }
    }

    func addFood(name: String, calories: Double?, protein: Double?, carbs: Double?, fat: Double?) async throws {
        guard let memberId = auth.memberId else { throw NutritionError.notSignedIn }
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { throw NutritionError.message("Food name is required.") }

        let inserted: CustomFood = try await client
            .from("nutrition_custom_foods")
            .insert(
                CustomFoodInsert(
                    memberId: memberId,
                    name: trimmed,
                    calories: calories,
                    protein: protein,
                    carbs: carbs,
                    fat: fat
                )
            )
            .select(foodColumns)
            .single()
            .execute()
            .value

        foods.insert(inserted, at: 0)
    }

    func deleteFood(_ food: CustomFood) async throws {
        guard let memberId = auth.memberId else { throw NutritionError.notSignedIn }
        try await client
            .from("nutrition_custom_foods")
            .delete()
            .eq("id", value: food.id)
            .eq("member_id", value: memberId)
            .execute()
        foods.removeAll { $0.id == food.id }
    }
}
