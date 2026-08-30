import Foundation
import HealthKit
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
    @Published var healthSnapshot = HealthSnapshot()
    @Published var maintenanceCalories: Double?
    @Published var metabolismSource: String?
    @Published var isSyncingHealth = false

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
            group.addTask { await self.refreshMetabolism() }
        }
    }

    func refreshMetabolism() async {
        guard let memberId = auth.memberId else { return }
        do {
            let plans: [CoachPlanMetabolism] = try await client
                .from("coach_nutrition_plans")
                .select("maintenance_calories, maintenance_calories_source, maintenance_calories_estimated_at, effective_date")
                .eq("member_id", value: memberId)
                .order("effective_date", ascending: false)
                .limit(1)
                .execute()
                .value
            maintenanceCalories = plans.first?.maintenanceCalories
            metabolismSource = plans.first?.maintenanceCaloriesSource
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func syncAppleHealth() async {
        guard let memberId = auth.memberId else { return }
        isSyncingHealth = true
        errorMessage = nil
        defer { isSyncingHealth = false }

        do {
            let snapshot = try await HealthKitReader.shared.readTodayAndLatestBodyComposition()
            healthSnapshot = snapshot
            var samples: [HealthStatWrite] = []
            if let value = snapshot.activeCalories {
                samples.append(.init(memberId: memberId, statKey: "active_calories", value: value, unit: "kcal", entryDate: snapshot.day))
            }
            if let value = snapshot.restingCalories {
                samples.append(.init(memberId: memberId, statKey: "resting_calories", value: value, unit: "kcal", entryDate: snapshot.day))
            }
            if let value = snapshot.weightLbs, let date = snapshot.weightDate {
                samples.append(.init(memberId: memberId, statKey: "body_weight", value: value, unit: "lb", entryDate: date))
            }
            if let value = snapshot.bodyFatPercent, let date = snapshot.bodyFatDate {
                samples.append(.init(memberId: memberId, statKey: "body_fat", value: value, unit: "%", entryDate: date))
            }
            for sample in samples {
                try await saveHealthStat(sample)
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func saveHealthStat(_ sample: HealthStatWrite) async throws {
        let existing: [HealthStatIdentity] = try await client
            .from("health_stat_entries")
            .select("id")
            .eq("member_id", value: sample.memberId)
            .eq("stat_key", value: sample.statKey)
            .eq("entry_date", value: sample.entryDate)
            .limit(1)
            .execute()
            .value

        if let id = existing.first?.id {
            try await client
                .from("health_stat_entries")
                .update(HealthStatValueUpdate(value: sample.value, unit: sample.unit))
                .eq("id", value: id)
                .execute()
        } else {
            try await client.from("health_stat_entries").insert(sample).execute()
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

struct HealthSnapshot {
    var day = DayFormat.isoDay(from: Date())
    var activeCalories: Double?
    var restingCalories: Double?
    var weightLbs: Double?
    var weightDate: String?
    var bodyFatPercent: Double?
    var bodyFatDate: String?

    var estimatedBurn: Double? {
        guard let activeCalories, let restingCalories else { return nil }
        return activeCalories + restingCalories
    }
}

private struct CoachPlanMetabolism: Decodable {
    let maintenanceCalories: Double
    let maintenanceCaloriesSource: String

    enum CodingKeys: String, CodingKey {
        case maintenanceCalories = "maintenance_calories"
        case maintenanceCaloriesSource = "maintenance_calories_source"
    }
}

private struct HealthStatIdentity: Decodable { let id: UUID }

private struct HealthStatWrite: Encodable {
    let memberId: UUID
    let statKey: String
    let value: Double
    let unit: String
    let entryDate: String

    enum CodingKeys: String, CodingKey {
        case memberId = "member_id"
        case statKey = "stat_key"
        case value, unit
        case entryDate = "entry_date"
    }
}

private struct HealthStatValueUpdate: Encodable {
    let value: Double
    let unit: String
}

private final class HealthKitReader: @unchecked Sendable {
    static let shared = HealthKitReader()
    private let store = HKHealthStore()

    func readTodayAndLatestBodyComposition() async throws -> HealthSnapshot {
        guard HKHealthStore.isHealthDataAvailable() else {
            throw NutritionError.message("Apple Health is not available on this device.")
        }
        let active = HKQuantityType(.activeEnergyBurned)
        let resting = HKQuantityType(.basalEnergyBurned)
        let weight = HKQuantityType(.bodyMass)
        let bodyFat = HKQuantityType(.bodyFatPercentage)
        try await store.requestAuthorization(toShare: [], read: [active, resting, weight, bodyFat])

        let calendar = Calendar.current
        let start = calendar.startOfDay(for: Date())
        let end = calendar.date(byAdding: .day, value: 1, to: start)!
        async let activeValue = cumulativeSum(type: active, unit: .kilocalorie(), start: start, end: end)
        async let restingValue = cumulativeSum(type: resting, unit: .kilocalorie(), start: start, end: end)
        async let weightValue = latest(type: weight, unit: .pound())
        async let bodyFatValue = latest(type: bodyFat, unit: .percent(), multiplier: 100)
        let (activeResult, restingResult, weightResult, bodyFatResult) = try await (activeValue, restingValue, weightValue, bodyFatValue)

        return HealthSnapshot(
            day: DayFormat.isoDay(from: start),
            activeCalories: activeResult,
            restingCalories: restingResult,
            weightLbs: weightResult?.value,
            weightDate: weightResult.map { DayFormat.isoDay(from: $0.date) },
            bodyFatPercent: bodyFatResult?.value,
            bodyFatDate: bodyFatResult.map { DayFormat.isoDay(from: $0.date) }
        )
    }

    private func cumulativeSum(type: HKQuantityType, unit: HKUnit, start: Date, end: Date) async throws -> Double? {
        try await withCheckedThrowingContinuation { continuation in
            let predicate = HKQuery.predicateForSamples(withStart: start, end: end)
            let query = HKStatisticsQuery(quantityType: type, quantitySamplePredicate: predicate, options: .cumulativeSum) { _, result, error in
                if let error { continuation.resume(throwing: error); return }
                continuation.resume(returning: result?.sumQuantity()?.doubleValue(for: unit))
            }
            store.execute(query)
        }
    }

    private func latest(type: HKQuantityType, unit: HKUnit, multiplier: Double = 1) async throws -> (value: Double, date: Date)? {
        try await withCheckedThrowingContinuation { continuation in
            let sort = NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: false)
            let query = HKSampleQuery(sampleType: type, predicate: nil, limit: 1, sortDescriptors: [sort]) { _, samples, error in
                if let error { continuation.resume(throwing: error); return }
                guard let sample = samples?.first as? HKQuantitySample else {
                    continuation.resume(returning: nil); return
                }
                continuation.resume(returning: (sample.quantity.doubleValue(for: unit) * multiplier, sample.endDate))
            }
            store.execute(query)
        }
    }
}
