import Foundation

struct FuelwiseCloudFood: Decodable {
    let id: Int
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

    enum CodingKeys: String, CodingKey {
        case id, name, detail, calories
        case mealType = "meal_type"
        case proteinG = "protein_g"
        case carbsG = "carbs_g"
        case fatG = "fat_g"
        case saturatedFatG = "saturated_fat_g"
        case sugarG = "sugar_g"
        case fiberG = "fiber_g"
    }
}

struct FuelwiseCloudTarget: Decodable {
    let calories: Int
    let proteinG: Int
    let carbsG: Int
    let fatG: Int

    enum CodingKeys: String, CodingKey {
        case calories
        case proteinG = "protein_g"
        case carbsG = "carbs_g"
        case fatG = "fat_g"
    }
}

struct FuelwiseCloudDashboard: Decodable {
    struct User: Decodable { let displayName: String }
    let user: User
    let goal: String
    let foods: [FuelwiseCloudFood]
    let target: FuelwiseCloudTarget?
}

enum FuelwiseAPI {
    private static let endpoint = URL(string: "https://fuelwise-adaptive-coach.daneff.chatgpt.site/api/data")!
    private static var deviceCredential: String { configurationValue("FuelwiseMobileSyncToken") }
    private static var siteAccessCredential: String { configurationValue("FuelwiseSitesAccessToken") }

    static func load(date: Date) async throws -> FuelwiseCloudDashboard {
        var components = URLComponents(url: endpoint, resolvingAgainstBaseURL: false)!
        components.queryItems = [URLQueryItem(name: "date", value: dateString(date))]
        var request = URLRequest(url: components.url!)
        request.setValue("Bearer \(deviceCredential)", forHTTPHeaderField: "Authorization")
        request.setValue("Bearer \(siteAccessCredential)", forHTTPHeaderField: "OAI-Sites-Authorization")
        request.cachePolicy = .reloadIgnoringLocalCacheData
        let (data, response) = try await URLSession.shared.data(for: request)
        try validate(response)
        return try JSONDecoder().decode(FuelwiseCloudDashboard.self, from: data)
    }

    static func addFood(_ meal: Meal, date: Date) async throws {
        try await post([
            "action": "add_food", "date": dateString(date), "name": meal.name,
            "mealType": meal.mealType,
            "detail": meal.detail, "calories": meal.calories,
            "protein": meal.protein, "carbs": meal.carbs, "fat": meal.fat,
            "saturatedFat": meal.saturatedFat, "sugar": meal.sugar, "fiber": meal.fiber,
        ])
    }

    static func saveCheckIn(weightLb: Double, bodyFat: Double?, calorieTarget: Int, proteinTarget: Int, recommendation: String, calorieDelta: Int) async throws {
        var values: [String: Any] = [
            "action": "save_checkin", "date": dateString(Date()), "goal": "Lose fat",
            "weightLb": weightLb, "calories": calorieTarget + calorieDelta,
            "protein": proteinTarget, "carbs": max(100, (calorieTarget - proteinTarget * 4 - 612) / 4),
            "fat": 68, "recommendation": recommendation, "calorieDelta": calorieDelta,
        ]
        if let bodyFat { values["bodyFat"] = bodyFat }
        try await post(values)
    }

    static func syncAppleHealth(_ summary: HealthSummary, date: Date) async throws {
        var values: [String: Any] = [
            "action": "sync_apple_health", "date": dateString(date),
            "activeEnergyKcal": summary.active, "restingEnergyKcal": summary.resting,
        ]
        if let weightKg = summary.weightKg { values["weightKg"] = weightKg }
        if let bodyFat = summary.bodyFatPercent { values["bodyFat"] = bodyFat }
        try await post(values)
    }

    private static func post(_ body: [String: Any]) async throws {
        var request = URLRequest(url: endpoint)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(deviceCredential)", forHTTPHeaderField: "Authorization")
        request.setValue("Bearer \(siteAccessCredential)", forHTTPHeaderField: "OAI-Sites-Authorization")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (_, response) = try await URLSession.shared.data(for: request)
        try validate(response)
    }

    private static func validate(_ response: URLResponse) throws {
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw URLError(.userAuthenticationRequired)
        }
    }

    private static func configurationValue(_ key: String) -> String {
        guard let value = Bundle.main.object(forInfoDictionaryKey: key) as? String,
              !value.isEmpty,
              !value.hasPrefix("$(") else { return "" }
        return value
    }

    private static func dateString(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: date)
    }
}
