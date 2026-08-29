import Foundation

enum MealType: String, Codable, CaseIterable, Identifiable {
    case breakfast
    case lunch
    case dinner
    case snack

    var id: String { rawValue }

    var title: String {
        switch self {
        case .breakfast: return "Breakfast"
        case .lunch: return "Lunch"
        case .dinner: return "Dinner"
        case .snack: return "Snack"
        }
    }

    var symbol: String {
        switch self {
        case .breakfast: return "sunrise.fill"
        case .lunch: return "sun.max.fill"
        case .dinner: return "moon.stars.fill"
        case .snack: return "leaf.fill"
        }
    }
}

struct NutritionDay: Codable, Identifiable, Hashable {
    let id: UUID
    var memberId: UUID
    var dayDate: String
    var calorieTarget: Double?
    var proteinTarget: Double?
    var carbsTarget: Double?
    var fatTarget: Double?
    var createdAt: Date?
    var updatedAt: Date?

    enum CodingKeys: String, CodingKey {
        case id
        case memberId = "member_id"
        case dayDate = "day_date"
        case calorieTarget = "calorie_target"
        case proteinTarget = "protein_target"
        case carbsTarget = "carbs_target"
        case fatTarget = "fat_target"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(UUID.self, forKey: .id)
        memberId = try c.decode(UUID.self, forKey: .memberId)
        dayDate = try c.decode(String.self, forKey: .dayDate)
        calorieTarget = c.decodeFlexibleDouble(forKey: .calorieTarget)
        proteinTarget = c.decodeFlexibleDouble(forKey: .proteinTarget)
        carbsTarget = c.decodeFlexibleDouble(forKey: .carbsTarget)
        fatTarget = c.decodeFlexibleDouble(forKey: .fatTarget)
        createdAt = c.decodeFlexibleDate(forKey: .createdAt)
        updatedAt = c.decodeFlexibleDate(forKey: .updatedAt)
    }
}

struct NutritionEntry: Codable, Identifiable, Hashable {
    let id: UUID
    var dayId: UUID
    var memberId: UUID
    var mealType: MealType
    var entryName: String
    var quantity: Double
    var calories: Double?
    var protein: Double?
    var carbs: Double?
    var fat: Double?
    var createdAt: Date?
    var updatedAt: Date?

    enum CodingKeys: String, CodingKey {
        case id
        case dayId = "day_id"
        case memberId = "member_id"
        case mealType = "meal_type"
        case entryName = "entry_name"
        case quantity, calories, protein, carbs, fat
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(UUID.self, forKey: .id)
        dayId = try c.decode(UUID.self, forKey: .dayId)
        memberId = try c.decode(UUID.self, forKey: .memberId)
        mealType = try c.decode(MealType.self, forKey: .mealType)
        entryName = try c.decode(String.self, forKey: .entryName)
        quantity = c.decodeFlexibleDouble(forKey: .quantity) ?? 1
        calories = c.decodeFlexibleDouble(forKey: .calories)
        protein = c.decodeFlexibleDouble(forKey: .protein)
        carbs = c.decodeFlexibleDouble(forKey: .carbs)
        fat = c.decodeFlexibleDouble(forKey: .fat)
        createdAt = c.decodeFlexibleDate(forKey: .createdAt)
        updatedAt = c.decodeFlexibleDate(forKey: .updatedAt)
    }
}

struct CustomFood: Codable, Identifiable, Hashable {
    let id: UUID
    var memberId: UUID
    var name: String
    var calories: Double?
    var protein: Double?
    var carbs: Double?
    var fat: Double?
    var createdAt: Date?
    var updatedAt: Date?

    enum CodingKeys: String, CodingKey {
        case id
        case memberId = "member_id"
        case name, calories, protein, carbs, fat
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(UUID.self, forKey: .id)
        memberId = try c.decode(UUID.self, forKey: .memberId)
        name = try c.decode(String.self, forKey: .name)
        calories = c.decodeFlexibleDouble(forKey: .calories)
        protein = c.decodeFlexibleDouble(forKey: .protein)
        carbs = c.decodeFlexibleDouble(forKey: .carbs)
        fat = c.decodeFlexibleDouble(forKey: .fat)
        createdAt = c.decodeFlexibleDate(forKey: .createdAt)
        updatedAt = c.decodeFlexibleDate(forKey: .updatedAt)
    }

    func scaled(by quantity: Double) -> MacroTotals {
        MacroTotals(
            calories: (calories ?? 0) * quantity,
            protein: (protein ?? 0) * quantity,
            carbs: (carbs ?? 0) * quantity,
            fat: (fat ?? 0) * quantity
        )
    }
}

struct MacroTotals: Hashable {
    var calories: Double
    var protein: Double
    var carbs: Double
    var fat: Double

    static let zero = MacroTotals(calories: 0, protein: 0, carbs: 0, fat: 0)

    static func + (lhs: MacroTotals, rhs: MacroTotals) -> MacroTotals {
        MacroTotals(
            calories: lhs.calories + rhs.calories,
            protein: lhs.protein + rhs.protein,
            carbs: lhs.carbs + rhs.carbs,
            fat: lhs.fat + rhs.fat
        )
    }
}

struct NutritionDayInsert: Encodable {
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

struct NutritionEntryInsert: Encodable {
    let memberId: UUID
    let dayId: UUID
    let mealType: String
    let entryName: String
    let quantity: Double
    let calories: Double?
    let protein: Double?
    let carbs: Double?
    let fat: Double?

    enum CodingKeys: String, CodingKey {
        case memberId = "member_id"
        case dayId = "day_id"
        case mealType = "meal_type"
        case entryName = "entry_name"
        case quantity, calories, protein, carbs, fat
    }
}

struct NutritionEntryUpdate: Encodable {
    var mealType: String?
    var entryName: String?
    var quantity: Double?
    var calories: Double?
    var protein: Double?
    var carbs: Double?
    var fat: Double?

    enum CodingKeys: String, CodingKey {
        case mealType = "meal_type"
        case entryName = "entry_name"
        case quantity, calories, protein, carbs, fat
    }
}

struct CustomFoodInsert: Encodable {
    let memberId: UUID
    let name: String
    let calories: Double?
    let protein: Double?
    let carbs: Double?
    let fat: Double?

    enum CodingKeys: String, CodingKey {
        case memberId = "member_id"
        case name, calories, protein, carbs, fat
    }
}

struct NutritionDayTargetUpdate: Encodable {
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

extension Array where Element == NutritionEntry {
    var totals: MacroTotals {
        reduce(.zero) { acc, entry in
            acc + MacroTotals(
                calories: entry.calories ?? 0,
                protein: entry.protein ?? 0,
                carbs: entry.carbs ?? 0,
                fat: entry.fat ?? 0
            )
        }
    }

    func groupedByMeal() -> [(MealType, [NutritionEntry])] {
        MealType.allCases.map { meal in
            (meal, filter { $0.mealType == meal })
        }
    }
}

enum DayFormat {
    private static let iso: DateFormatter = {
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian)
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = .current
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()

    private static let display: DateFormatter = {
        let f = DateFormatter()
        f.locale = .current
        f.setLocalizedDateFormatFromTemplate("EEE MMM d")
        return f
    }()

    static func isoDay(from date: Date) -> String {
        iso.string(from: date)
    }

    static func date(fromIso day: String) -> Date {
        iso.date(from: day) ?? Date()
    }

    static func display(fromIso day: String) -> String {
        let date = Self.date(fromIso: day)
        if Calendar.current.isDateInToday(date) { return "Today" }
        if Calendar.current.isDateInYesterday(date) { return "Yesterday" }
        if Calendar.current.isDateInTomorrow(date) { return "Tomorrow" }
        return display.string(from: date)
    }
}

extension KeyedDecodingContainer {
    func decodeFlexibleDouble(forKey key: Key) -> Double? {
        if !contains(key) { return nil }
        if (try? decodeNil(forKey: key)) == true { return nil }
        if let value = try? decode(Double.self, forKey: key) { return value }
        if let value = try? decode(Int.self, forKey: key) { return Double(value) }
        if let value = try? decode(String.self, forKey: key) { return Double(value) }
        return nil
    }

    func decodeFlexibleDate(forKey key: Key) -> Date? {
        if !contains(key) { return nil }
        if (try? decodeNil(forKey: key)) == true { return nil }
        if let value = try? decode(Date.self, forKey: key) { return value }
        if let raw = try? decode(String.self, forKey: key) {
            return ISO8601DateFormatter.supabase.date(from: raw)
        }
        return nil
    }
}

extension ISO8601DateFormatter {
    static let supabase: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()
}

enum NutritionError: LocalizedError {
    case notSignedIn
    case notConfigured
    case message(String)

    var errorDescription: String? {
        switch self {
        case .notSignedIn: return "Sign in to load nutrition data."
        case .notConfigured: return "Set SUPABASE_URL and SUPABASE_ANON_KEY in Config.xcconfig."
        case .message(let text): return text
        }
    }
}
