import Foundation
import Supabase

struct FuelwiseCloudFood: Identifiable {
    let id: UUID
    let name: String
    let mealType: String
    let detail: String
    let calories: Int
    let proteinG: Double
    let carbsG: Double
    let fatG: Double
    let saturatedFatG: Double
    let sugarG: Double
    let fiberG: Double
}

struct FuelwiseCloudTarget {
    let calories: Int
    let proteinG: Int
    let carbsG: Int
    let fatG: Int
}

struct FuelwiseCloudDashboard {
    struct User { let displayName: String }
    let user: User
    let goal: String
    let foods: [FuelwiseCloudFood]
    let target: FuelwiseCloudTarget?
}

@MainActor
final class FuelwiseAPI {
    private let client: SupabaseClient
    private let auth: FuelwiseAuthService

    init(client: SupabaseClient, auth: FuelwiseAuthService) {
        self.client = client
        self.auth = auth
    }

    func load(date: Date) async throws -> FuelwiseCloudDashboard {
        let memberId = try linkedMemberId()
        let profiles: [MemberProfileRow] = try await client
            .from("app_users")
            .select("full_name")
            .eq("id", value: memberId)
            .limit(1)
            .execute()
            .value
        let day = try await nutritionDay(memberId: memberId, date: date)
        let foods: [NutritionEntryRow]
        if let day {
            foods = try await client
                .from("nutrition_entries")
                .select("id, meal_type, entry_name, quantity, calories, protein, carbs, fat, saturated_fat, sugar, fiber")
                .eq("member_id", value: memberId)
                .eq("day_id", value: day.id)
                .order("created_at", ascending: true)
                .execute()
                .value
        } else {
            foods = []
        }

        let latestPlans: [CoachPlanRow] = try await client
            .from("coach_nutrition_plans")
            .select("goal_type, target_calories, protein_grams, carbs_grams, fat_grams")
            .eq("member_id", value: memberId)
            .order("effective_date", ascending: false)
            .limit(1)
            .execute()
            .value
        let plan = latestPlans.first

        return FuelwiseCloudDashboard(
            user: .init(displayName: profiles.first?.fullName ?? auth.displayName),
            goal: plan?.goalType ?? "",
            foods: foods.map(cloudFood(from:)),
            target: target(for: day, fallback: plan)
        )
    }

    func addFood(_ meal: Meal, date: Date) async throws {
        let memberId = try linkedMemberId()
        let day = try await ensureNutritionDay(memberId: memberId, date: date)
        try await client
            .from("nutrition_entries")
            .insert(NutritionEntryWrite(
                dayId: day.id,
                memberId: memberId,
                mealType: meal.mealType == "snacks" ? "snack" : meal.mealType,
                entryName: meal.name,
                quantity: 1,
                calories: Double(meal.calories),
                protein: Double(meal.protein),
                carbs: Double(meal.carbs),
                fat: Double(meal.fat),
                saturatedFat: Double(meal.saturatedFat),
                sugar: Double(meal.sugar),
                fiber: Double(meal.fiber)
            ))
            .execute()
    }

    func meal(date: Date, mealType: String) async throws -> [FuelwiseCloudFood] {
        let memberId = try linkedMemberId()
        guard let day = try await nutritionDay(memberId: memberId, date: date) else { return [] }
        let rows = try await nutritionEntries(memberId: memberId, dayId: day.id, mealType: mealType)
        return rows.map(cloudFood(from:))
    }

    @discardableResult
    func copyMeal(
        from sourceDate: Date,
        sourceMealType: String,
        to destinationDate: Date,
        destinationMealType: String
    ) async throws -> Int {
        let sourceDay = FuelwiseDayFormatter.isoDay(from: sourceDate)
        let destinationDay = FuelwiseDayFormatter.isoDay(from: destinationDate)
        guard sourceDay != destinationDay || normalizedMealType(sourceMealType) != normalizedMealType(destinationMealType) else {
            throw FuelwiseError.sameMealDestination
        }

        let memberId = try linkedMemberId()
        guard let source = try await nutritionDay(memberId: memberId, date: sourceDate) else {
            throw FuelwiseError.noMealToCopy
        }
        let sourceRows = try await nutritionEntries(memberId: memberId, dayId: source.id, mealType: sourceMealType)
        guard !sourceRows.isEmpty else { throw FuelwiseError.noMealToCopy }
        let destination = try await ensureNutritionDay(memberId: memberId, date: destinationDate)
        let writes = sourceRows.map { row in
            NutritionEntryWrite(
                dayId: destination.id,
                memberId: memberId,
                mealType: normalizedMealType(destinationMealType),
                entryName: row.entryName,
                quantity: row.quantity,
                calories: row.calories ?? 0,
                protein: row.protein ?? 0,
                carbs: row.carbs ?? 0,
                fat: row.fat ?? 0,
                saturatedFat: row.saturatedFat ?? 0,
                sugar: row.sugar ?? 0,
                fiber: row.fiber ?? 0
            )
        }
        try await client.from("nutrition_entries").insert(writes).execute()
        return writes.count
    }

    func saveCheckIn(
        weightLb: Double,
        bodyFat: Double?,
        calorieTarget: Int,
        proteinTarget: Int,
        recommendation: String,
        calorieDelta: Int
    ) async throws {
        let memberId = try linkedMemberId()
        let adjustedCalories = calorieTarget + calorieDelta
        let carbs = max(100, (adjustedCalories - proteinTarget * 4 - 68 * 9) / 4)
        let day = FuelwiseDayFormatter.isoDay(from: Date())

        try await client
            .from("nutrition_days")
            .upsert(
                NutritionDayWrite(
                    memberId: memberId,
                    dayDate: day,
                    calorieTarget: Double(adjustedCalories),
                    proteinTarget: Double(proteinTarget),
                    carbsTarget: Double(carbs),
                    fatTarget: 68
                ),
                onConflict: "member_id,day_date"
            )
            .execute()
        try await saveHealthStat(memberId: memberId, key: "body_weight", value: weightLb, unit: "lb", day: day)
        if let bodyFat {
            try await saveHealthStat(memberId: memberId, key: "body_fat", value: bodyFat, unit: "%", day: day)
        }

        // The adjusted targets and measurements are the durable member-owned result.
        _ = recommendation
    }

    func syncAppleHealth(_ summary: HealthSummary, date: Date) async throws {
        let memberId = try linkedMemberId()
        let day = FuelwiseDayFormatter.isoDay(from: date)
        try await saveHealthStat(memberId: memberId, key: "active_calories", value: Double(summary.active), unit: "kcal", day: day)
        try await saveHealthStat(memberId: memberId, key: "resting_calories", value: Double(summary.resting), unit: "kcal", day: day)
        if let weightKg = summary.weightKg {
            try await saveHealthStat(memberId: memberId, key: "body_weight", value: weightKg / 0.45359237, unit: "lb", day: day)
        }
        if let bodyFat = summary.bodyFatPercent {
            try await saveHealthStat(memberId: memberId, key: "body_fat", value: bodyFat, unit: "%", day: day)
        }
    }

    private func linkedMemberId() throws -> UUID {
        guard let memberId = auth.memberId else { throw FuelwiseError.accountNotLinked }
        return memberId
    }

    private func nutritionDay(memberId: UUID, date: Date) async throws -> NutritionDayRow? {
        let rows: [NutritionDayRow] = try await client
            .from("nutrition_days")
            .select("id, calorie_target, protein_target, carbs_target, fat_target")
            .eq("member_id", value: memberId)
            .eq("day_date", value: FuelwiseDayFormatter.isoDay(from: date))
            .limit(1)
            .execute()
            .value
        return rows.first
    }

    private func nutritionEntries(memberId: UUID, dayId: UUID, mealType: String) async throws -> [NutritionEntryRow] {
        try await client
            .from("nutrition_entries")
            .select("id, meal_type, entry_name, quantity, calories, protein, carbs, fat, saturated_fat, sugar, fiber")
            .eq("member_id", value: memberId)
            .eq("day_id", value: dayId)
            .eq("meal_type", value: normalizedMealType(mealType))
            .order("created_at", ascending: true)
            .execute()
            .value
    }

    private func normalizedMealType(_ mealType: String) -> String {
        mealType == "snacks" ? "snack" : mealType
    }

    private func cloudFood(from row: NutritionEntryRow) -> FuelwiseCloudFood {
        FuelwiseCloudFood(
            id: row.id,
            name: row.entryName,
            mealType: row.mealType == "snack" ? "snacks" : row.mealType,
            detail: row.quantity == 1 ? "1 serving" : "\(row.quantity.formatted()) servings",
            calories: Int((row.calories ?? 0).rounded()),
            proteinG: row.protein ?? 0,
            carbsG: row.carbs ?? 0,
            fatG: row.fat ?? 0,
            saturatedFatG: row.saturatedFat ?? 0,
            sugarG: row.sugar ?? 0,
            fiberG: row.fiber ?? 0
        )
    }

    private func ensureNutritionDay(memberId: UUID, date: Date) async throws -> NutritionDayRow {
        if let day = try await nutritionDay(memberId: memberId, date: date) { return day }
        return try await client
            .from("nutrition_days")
            .upsert(
                NutritionDayWrite(memberId: memberId, dayDate: FuelwiseDayFormatter.isoDay(from: date), calorieTarget: nil, proteinTarget: nil, carbsTarget: nil, fatTarget: nil),
                onConflict: "member_id,day_date"
            )
            .select("id, calorie_target, protein_target, carbs_target, fat_target")
            .single()
            .execute()
            .value
    }

    private func target(for day: NutritionDayRow?, fallback plan: CoachPlanRow?) -> FuelwiseCloudTarget? {
        guard let calories = day?.calorieTarget ?? plan?.targetCalories,
              let protein = day?.proteinTarget ?? plan?.proteinGrams,
              let carbs = day?.carbsTarget ?? plan?.carbsGrams,
              let fat = day?.fatTarget ?? plan?.fatGrams else { return nil }
        return .init(
            calories: Int(calories.rounded()),
            proteinG: Int(protein.rounded()),
            carbsG: Int(carbs.rounded()),
            fatG: Int(fat.rounded())
        )
    }

    private func saveHealthStat(memberId: UUID, key: String, value: Double, unit: String, day: String) async throws {
        let existing: [HealthStatIdentity] = try await client
            .from("health_stat_entries")
            .select("id")
            .eq("member_id", value: memberId)
            .eq("stat_key", value: key)
            .eq("entry_date", value: day)
            .limit(1)
            .execute()
            .value
        if let id = existing.first?.id {
            try await client.from("health_stat_entries")
                .update(HealthStatValueWrite(value: value, unit: unit))
                .eq("id", value: id)
                .execute()
        } else {
            try await client.from("health_stat_entries")
                .insert(HealthStatWrite(memberId: memberId, statKey: key, value: value, unit: unit, entryDate: day))
                .execute()
        }
    }
}

private struct NutritionDayRow: Decodable {
    let id: UUID
    let calorieTarget: Double?
    let proteinTarget: Double?
    let carbsTarget: Double?
    let fatTarget: Double?
    enum CodingKeys: String, CodingKey {
        case id
        case calorieTarget = "calorie_target"
        case proteinTarget = "protein_target"
        case carbsTarget = "carbs_target"
        case fatTarget = "fat_target"
    }
}

private struct MemberProfileRow: Decodable {
    let fullName: String?
    enum CodingKeys: String, CodingKey { case fullName = "full_name" }
}

private struct NutritionEntryRow: Decodable {
    let id: UUID
    let mealType: String
    let entryName: String
    let quantity: Double
    let calories: Double?
    let protein: Double?
    let carbs: Double?
    let fat: Double?
    let saturatedFat: Double?
    let sugar: Double?
    let fiber: Double?
    enum CodingKeys: String, CodingKey {
        case id, quantity, calories, protein, carbs, fat, sugar, fiber
        case mealType = "meal_type"
        case entryName = "entry_name"
        case saturatedFat = "saturated_fat"
    }
}

private struct CoachPlanRow: Decodable {
    let goalType: String?
    let targetCalories: Double?
    let proteinGrams: Double?
    let carbsGrams: Double?
    let fatGrams: Double?
    enum CodingKeys: String, CodingKey {
        case goalType = "goal_type"
        case targetCalories = "target_calories"
        case proteinGrams = "protein_grams"
        case carbsGrams = "carbs_grams"
        case fatGrams = "fat_grams"
    }
}

private struct NutritionDayWrite: Encodable {
    let memberId: UUID
    let dayDate: String
    let calorieTarget: Double?
    let proteinTarget: Double?
    let carbsTarget: Double?
    let fatTarget: Double?
    enum CodingKeys: String, CodingKey {
        case memberId = "member_id"
        case dayDate = "day_date"
        case calorieTarget = "calorie_target"
        case proteinTarget = "protein_target"
        case carbsTarget = "carbs_target"
        case fatTarget = "fat_target"
    }
}

private struct NutritionEntryWrite: Encodable {
    let dayId: UUID
    let memberId: UUID
    let mealType: String
    let entryName: String
    let quantity: Double
    let calories: Double
    let protein: Double
    let carbs: Double
    let fat: Double
    let saturatedFat: Double
    let sugar: Double
    let fiber: Double
    enum CodingKeys: String, CodingKey {
        case dayId = "day_id"
        case memberId = "member_id"
        case mealType = "meal_type"
        case entryName = "entry_name"
        case quantity, calories, protein, carbs, fat, sugar, fiber
        case saturatedFat = "saturated_fat"
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

private struct HealthStatValueWrite: Encodable {
    let value: Double
    let unit: String
}

enum FuelwiseDayFormatter {
    private static let formatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = .current
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()

    static func isoDay(from date: Date) -> String { formatter.string(from: date) }
}
