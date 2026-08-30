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
    @Published var healthAccessStatus: HealthAccessStatus = .checking
    @Published var lastHealthSyncAt: Date?
    @Published var healthHistory: [HealthTrendPoint] = []
    @Published var metabolismHistory: [MetabolismEstimate] = []

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
            group.addTask { await self.loadPersistedHealth() }
            group.addTask { await self.refreshHealthAccessStatus() }
        }
    }

    func refreshFromForeground() async {
        await loadPersistedHealth()
        await refreshHealthAccessStatus()
        await autoSyncHealthIfAuthorized()
    }

    func autoSyncHealthIfAuthorized() async {
        guard healthAccessStatus == .ready else { return }
        await syncAppleHealth(requestAuthorization: false)
    }

    func refreshMetabolism() async {
        guard let memberId = auth.memberId else { return }
        do {
            let plans: [MetabolismEstimate] = try await client
                .from("coach_nutrition_plans")
                .select("maintenance_calories, maintenance_calories_source, maintenance_calories_estimated_at, effective_date")
                .eq("member_id", value: memberId)
                .order("effective_date", ascending: false)
                .limit(24)
                .execute()
                .value
            metabolismHistory = plans
            maintenanceCalories = plans.first?.maintenanceCalories
            metabolismSource = plans.first?.maintenanceCaloriesSource
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func syncAppleHealth(requestAuthorization: Bool = true) async {
        guard let memberId = auth.memberId else { return }
        guard !isSyncingHealth else { return }
        isSyncingHealth = true
        errorMessage = nil
        defer { isSyncingHealth = false }

        do {
            if requestAuthorization {
                try await HealthKitReader.shared.requestAuthorization()
            } else if try await HealthKitReader.shared.authorizationRequestStatus() == .shouldRequest {
                healthAccessStatus = .needsPermission
                return
            }

            let snapshot = try await HealthKitReader.shared.readTodayAndLatestBodyComposition()
            healthSnapshot = healthSnapshot.merging(snapshot)
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
            if !samples.isEmpty {
                lastHealthSyncAt = Date()
            }
            healthAccessStatus = .ready
        } catch {
            healthAccessStatus = .failed(error.localizedDescription)
        }
    }

    func loadPersistedHealth() async {
        guard let memberId = auth.memberId else { return }
        do {
            let cutoff = Calendar.current.date(byAdding: .year, value: -1, to: Date()) ?? Date()
            let rows: [HealthTrendPoint] = try await client
                .from("health_stat_entries")
                .select("id, stat_key, value, unit, entry_date, updated_at")
                .eq("member_id", value: memberId)
                .gte("entry_date", value: DayFormat.isoDay(from: cutoff))
                .order("entry_date", ascending: true)
                .limit(1000)
                .execute()
                .value

            let orderedRows = rows.sorted {
                if $0.entryDate == $1.entryDate {
                    return ($0.updatedAt ?? .distantPast) < ($1.updatedAt ?? .distantPast)
                }
                return $0.entryDate < $1.entryDate
            }
            healthHistory = orderedRows
            let today = DayFormat.isoDay(from: Date())
            let active = orderedRows.last { $0.statKey == "active_calories" && $0.entryDate == today }
            let resting = orderedRows.last { $0.statKey == "resting_calories" && $0.entryDate == today }
            let weight = orderedRows.last { $0.statKey == "body_weight" }
            let bodyFat = orderedRows.last { $0.statKey == "body_fat" }
            healthSnapshot = HealthSnapshot(
                day: today,
                activeCalories: active?.value,
                restingCalories: resting?.value,
                weightLbs: weight?.value,
                weightDate: weight?.entryDate,
                bodyFatPercent: bodyFat?.value,
                bodyFatDate: bodyFat?.entryDate
            )
            lastHealthSyncAt = orderedRows.compactMap(\.updatedAt).max()
        } catch {
            healthAccessStatus = .failed("Saved health data could not be loaded: \(error.localizedDescription)")
        }
    }

    func refreshHealthAccessStatus() async {
        guard HealthKitReader.isAvailable else {
            healthAccessStatus = .unavailable
            return
        }
        do {
            let requestStatus = try await HealthKitReader.shared.authorizationRequestStatus()
            healthAccessStatus = requestStatus == .shouldRequest ? .needsPermission : .ready
        } catch {
            healthAccessStatus = .failed(error.localizedDescription)
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

    func merging(_ newer: HealthSnapshot) -> HealthSnapshot {
        HealthSnapshot(
            day: newer.day,
            activeCalories: newer.activeCalories ?? activeCalories,
            restingCalories: newer.restingCalories ?? restingCalories,
            weightLbs: newer.weightLbs ?? weightLbs,
            weightDate: newer.weightDate ?? weightDate,
            bodyFatPercent: newer.bodyFatPercent ?? bodyFatPercent,
            bodyFatDate: newer.bodyFatDate ?? bodyFatDate
        )
    }
}

enum HealthAccessStatus: Equatable {
    case checking
    case needsPermission
    case ready
    case unavailable
    case failed(String)

    var message: String {
        switch self {
        case .checking: "Checking Apple Health…"
        case .needsPermission: "Tap sync to allow Apple Health access"
        case .ready: "Apple Health ready"
        case .unavailable: "Apple Health is unavailable on this device"
        case .failed(let message): "Sync error: \(message)"
        }
    }

    var symbol: String {
        switch self {
        case .checking: "clock"
        case .needsPermission: "hand.raised.fill"
        case .ready: "checkmark.circle.fill"
        case .unavailable, .failed: "exclamationmark.triangle.fill"
        }
    }
}

struct MetabolismEstimate: Decodable, Identifiable {
    let maintenanceCalories: Double
    let maintenanceCaloriesSource: String
    let estimatedAt: Date?
    let effectiveDate: String

    var id: String { effectiveDate }

    enum CodingKeys: String, CodingKey {
        case maintenanceCalories = "maintenance_calories"
        case maintenanceCaloriesSource = "maintenance_calories_source"
        case estimatedAt = "maintenance_calories_estimated_at"
        case effectiveDate = "effective_date"
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        maintenanceCalories = try container.decode(Double.self, forKey: .maintenanceCalories)
        maintenanceCaloriesSource = try container.decode(String.self, forKey: .maintenanceCaloriesSource)
        estimatedAt = container.decodeFlexibleDate(forKey: .estimatedAt)
        effectiveDate = try container.decode(String.self, forKey: .effectiveDate)
    }
}

private struct HealthStatIdentity: Decodable { let id: UUID }

struct HealthTrendPoint: Decodable, Identifiable {
    let id: UUID
    let statKey: String
    let value: Double
    let unit: String
    let entryDate: String
    let updatedAt: Date?

    enum CodingKeys: String, CodingKey {
        case id
        case statKey = "stat_key"
        case value, unit
        case entryDate = "entry_date"
        case updatedAt = "updated_at"
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(UUID.self, forKey: .id)
        statKey = try container.decode(String.self, forKey: .statKey)
        value = try container.decode(Double.self, forKey: .value)
        unit = try container.decode(String.self, forKey: .unit)
        entryDate = try container.decode(String.self, forKey: .entryDate)
        updatedAt = container.decodeFlexibleDate(forKey: .updatedAt)
    }
}

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
    static var isAvailable: Bool { HKHealthStore.isHealthDataAvailable() }
    private let store = HKHealthStore()

    private var readTypes: Set<HKObjectType> {
        [
            HKQuantityType(.activeEnergyBurned),
            HKQuantityType(.basalEnergyBurned),
            HKQuantityType(.bodyMass),
            HKQuantityType(.bodyFatPercentage)
        ]
    }

    func requestAuthorization() async throws {
        guard Self.isAvailable else {
            throw NutritionError.message("Apple Health is not available on this device.")
        }
        try await store.requestAuthorization(toShare: [], read: readTypes)
    }

    func authorizationRequestStatus() async throws -> HKAuthorizationRequestStatus {
        guard Self.isAvailable else { return .unknown }
        return try await withCheckedThrowingContinuation { continuation in
            store.getRequestStatusForAuthorization(toShare: [], read: readTypes) { status, error in
                if let error {
                    continuation.resume(throwing: error)
                } else {
                    continuation.resume(returning: status)
                }
            }
        }
    }

    func readTodayAndLatestBodyComposition() async throws -> HealthSnapshot {
        guard Self.isAvailable else {
            throw NutritionError.message("Apple Health is not available on this device.")
        }
        let active = HKQuantityType(.activeEnergyBurned)
        let resting = HKQuantityType(.basalEnergyBurned)
        let weight = HKQuantityType(.bodyMass)
        let bodyFat = HKQuantityType(.bodyFatPercentage)

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
