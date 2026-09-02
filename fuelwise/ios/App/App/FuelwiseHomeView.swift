import SwiftUI

private struct Macro: Identifiable {
    let id = UUID()
    let name: String
    let consumed: Int
    let target: Int
    let color: Color
}

struct Meal: Identifiable {
    let id = UUID()
    let icon: String
    let mealType: String
    let name: String
    let detail: String
    let calories: Int
    let protein: Int
    let carbs: Int
    let fat: Int
    let saturatedFat: Int
    let sugar: Int
    let fiber: Int
}

private struct CopyMealDestination: Identifiable {
    let id = UUID()
    let date: Date
    let mealType: String
    let title: String
    let existingItemCount: Int
}

struct FuelwiseHomeView: View {
    @EnvironmentObject private var session: FuelwiseSession
    @AppStorage("fuelwise.firstName") private var firstName = "Daniel"
    @AppStorage("fuelwise.calorieTarget") private var savedCalorieTarget = 2250
    @AppStorage("fuelwise.proteinTarget") private var savedProteinTarget = 175
    @State private var showAddFood = false
    @State private var selectedMealType = "snacks"
    @State private var showCheckIn = false
    @State private var copyMealDestination: CopyMealDestination?
    @State private var coachingVisible = true
    @State private var cloudStatus = "Syncing…"
    @State private var selectedDate = Calendar.current.startOfDay(for: Date())
    @State private var healthSummary: HealthSummary?
    @State private var healthStatus = "Connecting to Apple Health…"
    @State private var meals: [Meal] = [
        Meal(icon: "sun.max.fill", mealType: "breakfast", name: "Greek yogurt bowl", detail: "Greek yogurt, berries & granola", calories: 485, protein: 32, carbs: 58, fat: 14, saturatedFat: 4, sugar: 22, fiber: 7),
        Meal(icon: "circle.lefthalf.filled", mealType: "lunch", name: "Chicken rice bowl", detail: "Chicken, rice and vegetables", calories: 612, protein: 51, carbs: 73, fat: 17, saturatedFat: 4, sugar: 8, fiber: 9),
        Meal(icon: "diamond.fill", mealType: "snacks", name: "Protein shake & banana", detail: "Afternoon snack", calories: 296, protein: 31, carbs: 36, fat: 4, saturatedFat: 1, sugar: 19, fiber: 4)
    ]

    private var calories: Int { meals.reduce(0) { $0 + $1.calories } }
    private var calorieTarget: Int { savedCalorieTarget }
    private var macros: [Macro] {
        let carbTarget = max(100, (savedCalorieTarget - savedProteinTarget * 4 - 68 * 9) / 4)
        return [
            Macro(name: "Protein", consumed: meals.reduce(0) { $0 + $1.protein }, target: savedProteinTarget, color: .indigo),
            Macro(name: "Carbs", consumed: meals.reduce(0) { $0 + $1.carbs }, target: carbTarget, color: .orange),
            Macro(name: "Fat", consumed: meals.reduce(0) { $0 + $1.fat }, target: 68, color: .mint)
        ]
    }

    var body: some View {
        TabView {
            NavigationStack {
                ScrollView {
                    VStack(alignment: .leading, spacing: 22) {
                        header
                        dayPicker
                        bodyMetricsCard
                        if coachingVisible { coachingCard }
                        nutritionOverview
                        foodLog
                    }
                    .padding(.horizontal, 20)
                    .padding(.bottom, 28)
                }
                .background(Color(.systemGroupedBackground))
                .toolbar(.hidden, for: .navigationBar)
            }
            .tabItem { Label("Today", systemImage: "house.fill") }

            NativeActionView(title: "Add food", icon: "plus.circle.fill") { showAddFood = true }
                .tabItem { Label("Add food", systemImage: "plus.circle.fill") }

            WeeklyCheckInView(calorieTarget: calorieTarget, proteinTarget: savedProteinTarget, onSave: saveWeeklyCheckIn)
                .tabItem { Label("Check-in", systemImage: "checkmark.circle.fill") }
        }
        .tint(.indigo)
        .sheet(isPresented: $showAddFood) {
            AddFoodView(mealType: selectedMealType) { meal in
                meals.append(meal)
                cloudStatus = "Saving…"
                Task {
                    do {
                        try await session.api?.addFood(meal, date: selectedDate)
                        await MainActor.run { cloudStatus = "Supabase synced" }
                    } catch {
                        await MainActor.run { cloudStatus = "Sync issue" }
                    }
                }
            }
        }
        .sheet(isPresented: $showCheckIn) {
            WeeklyCheckInView(calorieTarget: calorieTarget, proteinTarget: savedProteinTarget, onSave: saveWeeklyCheckIn)
        }
        .sheet(item: $copyMealDestination) { destination in
            CopyMealView(destination: destination) {
                await loadSelectedDay()
            }
        }
        .task { await loadSelectedDay() }
        .onChange(of: selectedDate) { _, _ in Task { await loadSelectedDay() } }
    }

    private func saveWeeklyCheckIn(weight: Double, bodyFat: Double?, recommendation: String, calorieDelta: Int) async throws {
        await MainActor.run { cloudStatus = "Saving…" }
        guard let api = session.api else { throw FuelwiseError.notConfigured }
        try await api.saveCheckIn(weightLb: weight, bodyFat: bodyFat, calorieTarget: calorieTarget, proteinTarget: savedProteinTarget, recommendation: recommendation, calorieDelta: calorieDelta)
        await MainActor.run { cloudStatus = "Supabase synced" }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 7) {
            Text(selectedDate.formatted(.dateTime.weekday(.wide).month(.wide).day()).uppercased())
                .font(.caption.weight(.semibold)).foregroundStyle(.secondary).tracking(1.1)
            HStack(alignment: .firstTextBaseline) {
                Text(Calendar.current.isDateInToday(selectedDate) ? "Good morning, \(firstName)" : selectedDate.formatted(.dateTime.month(.wide).day()))
                    .font(.system(size: 30, weight: .bold, design: .rounded))
                Spacer()
                Button("Check-in") { showCheckIn = true }.font(.subheadline.weight(.semibold))
            }
            Label(cloudStatus, systemImage: cloudStatus == "Supabase synced" ? "checkmark.icloud.fill" : "icloud")
                .font(.caption.weight(.medium))
                .foregroundStyle(cloudStatus == "Sync issue" ? .red : .secondary)
        }
        .padding(.top, 24)
    }

    private var dayPicker: some View {
        HStack {
            Button { moveDay(-1) } label: { Image(systemName: "chevron.left") }
                .buttonStyle(.bordered).accessibilityLabel("Previous day")
            Spacer()
            DatePicker("Day", selection: $selectedDate, in: ...Date(), displayedComponents: .date)
                .labelsHidden().datePickerStyle(.compact)
            if !Calendar.current.isDateInToday(selectedDate) {
                Button("Today") { selectedDate = Calendar.current.startOfDay(for: Date()) }.font(.subheadline.weight(.semibold))
            }
            Spacer()
            Button { moveDay(1) } label: { Image(systemName: "chevron.right") }
                .buttonStyle(.bordered).disabled(Calendar.current.isDateInToday(selectedDate)).accessibilityLabel("Next day")
        }
        .padding(12).background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 16))
    }

    private func moveDay(_ amount: Int) {
        if let date = Calendar.current.date(byAdding: .day, value: amount, to: selectedDate), date <= Date() {
            selectedDate = Calendar.current.startOfDay(for: date)
        }
    }

    private func loadSelectedDay() async {
        await MainActor.run { cloudStatus = "Syncing…"; healthStatus = "Reading Apple Health…" }
        guard let api = session.api else {
            await MainActor.run { cloudStatus = "Sync issue" }
            return
        }
        async let cloud = api.load(date: selectedDate)
        async let health = HealthEnergyService.summary(for: selectedDate)
        do {
            let dashboard = try await cloud
            await MainActor.run {
                firstName = dashboard.user.displayName.components(separatedBy: " ").first ?? firstName
                if let target = dashboard.target {
                    savedCalorieTarget = target.calories
                    savedProteinTarget = target.proteinG
                }
                meals = dashboard.foods.map {
                    Meal(icon: "fork.knife", mealType: $0.mealType, name: $0.name, detail: $0.detail, calories: $0.calories, protein: Int($0.proteinG), carbs: Int($0.carbsG), fat: Int($0.fatG), saturatedFat: Int($0.saturatedFatG), sugar: Int($0.sugarG), fiber: Int($0.fiberG))
                }
                cloudStatus = "Supabase synced"
            }
        } catch {
            await MainActor.run { cloudStatus = "Sync issue" }
        }
        do {
            let summary = try await health
            try await api.syncAppleHealth(summary, date: selectedDate)
            await MainActor.run { healthSummary = summary; healthStatus = summary.total > 0 ? "Synced from Apple Health" : "Health synced · no energy for this day" }
        } catch {
            await MainActor.run { healthSummary = nil; healthStatus = "Allow Health access to sync your metrics" }
        }
    }

    private var estimatedMetabolism: Int? {
        guard let summary = healthSummary else { return nil }
        if let weight = summary.weightKg, let bodyFat = summary.bodyFatPercent {
            return Int((370 + 21.6 * weight * (1 - bodyFat / 100)).rounded())
        }
        return summary.resting > 0 ? summary.resting : nil
    }

    private var bodyMetricsCard: some View {
        HStack(spacing: 0) {
            topMetric("Est. metabolism", estimatedMetabolism.map { "\($0.formatted())" } ?? "—", "kcal/day")
            Divider().frame(height: 42)
            topMetric("Body weight", healthSummary?.weightKg.map { String(format: "%.1f", $0 / 0.45359237) } ?? "—", "lb")
            Divider().frame(height: 42)
            topMetric("Body fat", healthSummary?.bodyFatPercent.map { String(format: "%.1f", $0) } ?? "—", "%")
        }
        .padding(.vertical, 14)
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 18))
        .accessibilityElement(children: .contain)
    }

    private func topMetric(_ label: String, _ value: String, _ unit: String) -> some View {
        VStack(spacing: 3) {
            Text(label).font(.caption2).foregroundStyle(.secondary).lineLimit(1).minimumScaleFactor(0.8)
            Text(value).font(.title3.bold())
            Text(unit).font(.caption2).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
    }

    private var coachingCard: some View {
        HStack(alignment: .top, spacing: 14) {
            Image(systemName: "sparkles").font(.title3).foregroundStyle(.indigo)
            VStack(alignment: .leading, spacing: 5) {
                Text("You’re right on track").font(.headline)
                Text("Your 7-day weight trend is down 0.6 lb. Keep targets steady this week.")
                    .font(.subheadline).foregroundStyle(.secondary)
            }
            Spacer()
            Button { withAnimation { coachingVisible = false } } label: {
                Image(systemName: "xmark").foregroundStyle(.secondary)
            }
        }
        .padding(18)
        .background(Color.indigo.opacity(0.09), in: RoundedRectangle(cornerRadius: 20))
    }

    private var nutritionOverview: some View {
        VStack(alignment: .leading, spacing: 18) {
            Text("TODAY’S NUTRITION").font(.caption.weight(.bold)).foregroundStyle(.secondary).tracking(1)
            HStack(alignment: .center, spacing: 22) {
                ZStack {
                    Circle().stroke(Color.indigo.opacity(0.12), lineWidth: 15)
                    Circle()
                        .trim(from: 0, to: min(Double(calories) / Double(max(calorieTarget, 1)), 1))
                        .stroke(Color.indigo, style: StrokeStyle(lineWidth: 15, lineCap: .round))
                        .rotationEffect(.degrees(-90))
                        .animation(.easeOut, value: calories)
                    VStack(spacing: 1) {
                        Text(calories.formatted()).font(.system(size: 25, weight: .bold, design: .rounded))
                        Text("/ \(calorieTarget.formatted())").font(.caption.weight(.semibold)).foregroundStyle(.secondary)
                        Text("kcal").font(.caption2).foregroundStyle(.secondary)
                    }
                }
                .frame(width: 132, height: 132)
                .accessibilityLabel("\(calories) of \(calorieTarget) calorie target")

                VStack(spacing: 13) {
                    ForEach(macros) { macro in macroTargetRow(macro) }
                }
                .frame(maxWidth: .infinity)
            }

            Divider()
            HStack(spacing: 0) {
                compactNutrient("Sat fat", value: meals.reduce(0) { $0 + $1.saturatedFat }, target: 20)
                compactNutrient("Sugar", value: meals.reduce(0) { $0 + $1.sugar }, target: 50)
                compactNutrient("Fiber", value: meals.reduce(0) { $0 + $1.fiber }, target: 30)
            }
        }
        .padding(20)
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 24))
    }

    private func macroTargetRow(_ macro: Macro) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            HStack(alignment: .firstTextBaseline, spacing: 3) {
                Text("\(macro.consumed)").font(.headline)
                Text("/ \(macro.target)g \(macro.name)").font(.subheadline).foregroundStyle(.secondary)
            }
            ProgressView(value: Double(macro.consumed), total: Double(max(macro.target, 1))).tint(macro.color)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityLabel("\(macro.consumed) of \(macro.target) grams \(macro.name)")
    }

    private func compactNutrient(_ name: String, value: Int, target: Int) -> some View {
        VStack(spacing: 3) {
            Text("\(value) / \(target)g").font(.subheadline.bold())
            Text(name).font(.caption).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
    }

    private var foodLog: some View {
        VStack(alignment: .leading, spacing: 9) {
            Text("Meals").font(.title2.bold())
            ForEach([("breakfast", "Breakfast", "sun.max.fill"), ("lunch", "Lunch", "sun.haze.fill"), ("dinner", "Dinner", "moon.stars.fill"), ("snacks", "Snacks", "takeoutbag.and.cup.and.straw.fill")], id: \.0) { type, title, icon in
                mealCard(type: type, title: title, icon: icon)
            }
        }
    }

    private func mealCard(type: String, title: String, icon: String) -> some View {
        let entries = meals.filter { $0.mealType == type }
        return VStack(spacing: 0) {
            HStack {
                Label(title, systemImage: icon).font(.headline).foregroundStyle(.indigo)
                Spacer()
                Text("\(entries.reduce(0) { $0 + $1.calories }) kcal").font(.caption.weight(.semibold)).foregroundStyle(.secondary)
                Button {
                    copyMealDestination = CopyMealDestination(
                        date: selectedDate,
                        mealType: type,
                        title: title,
                        existingItemCount: entries.count
                    )
                } label: {
                    Image(systemName: "doc.on.doc").font(.subheadline).frame(width: 30, height: 30)
                }
                .buttonStyle(.bordered)
                .buttonBorderShape(.circle)
                .accessibilityLabel("Copy a meal into \(title)")
                Button {
                    selectedMealType = type
                    showAddFood = true
                } label: {
                    Image(systemName: "plus").font(.headline).frame(width: 30, height: 30)
                }
                .buttonStyle(.borderedProminent).buttonBorderShape(.circle)
                .accessibilityLabel("Add food to \(title)")
            }
            .padding(.vertical, 10)
            if entries.isEmpty {
                Text("No foods added").font(.subheadline).foregroundStyle(.secondary).frame(maxWidth: .infinity, alignment: .leading).padding(.bottom, 11)
            } else {
                ForEach(Array(entries.enumerated()), id: \.element.id) { index, meal in
                    HStack(spacing: 10) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(meal.name).font(.headline)
                            Text(meal.detail + " · P \(meal.protein)g · C \(meal.carbs)g · F \(meal.fat)g").font(.caption).foregroundStyle(.secondary).lineLimit(2)
                        }
                        Spacer()
                        Text("\(meal.calories) kcal").font(.subheadline.weight(.semibold))
                    }
                    .padding(.vertical, 11)
                    if index < entries.count - 1 { Divider() }
                }
            }
        }
        .padding(.horizontal, 14)
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 18))
    }
}

private struct NativeActionView: View {
    let title: String
    let icon: String
    let action: () -> Void
    var body: some View {
        VStack(spacing: 18) {
            Spacer()
            Image(systemName: icon).font(.system(size: 54)).foregroundStyle(.indigo)
            Text(title).font(.title.bold())
            Button(title, action: action).buttonStyle(.borderedProminent)
            Spacer()
        }
    }
}

private struct AddFoodView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var calories = ""
    @State private var protein = ""
    @State private var carbs = ""
    @State private var fat = ""
    @State private var saturatedFat = ""
    @State private var sugar = ""
    @State private var fiber = ""
    let mealType: String
    let onSave: (Meal) -> Void

    var body: some View {
        NavigationStack {
            Form {
                Section("Food") { TextField("Name", text: $name) }
                Section("Nutrition") {
                    TextField("Calories", text: $calories).keyboardType(.numberPad)
                    TextField("Protein (g)", text: $protein).keyboardType(.decimalPad)
                    TextField("Carbohydrates (g)", text: $carbs).keyboardType(.decimalPad)
                    TextField("Total fat (g)", text: $fat).keyboardType(.decimalPad)
                    TextField("Saturated fat (g)", text: $saturatedFat).keyboardType(.decimalPad)
                    TextField("Sugar (g)", text: $sugar).keyboardType(.decimalPad)
                    TextField("Fiber (g)", text: $fiber).keyboardType(.decimalPad)
                }
            }
            .navigationTitle("Add to \(mealType.capitalized)")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        onSave(Meal(icon: "fork.knife", mealType: mealType, name: name, detail: "Custom food entry", calories: Int(calories) ?? 0, protein: Int(Double(protein) ?? 0), carbs: Int(Double(carbs) ?? 0), fat: Int(Double(fat) ?? 0), saturatedFat: Int(Double(saturatedFat) ?? 0), sugar: Int(Double(sugar) ?? 0), fiber: Int(Double(fiber) ?? 0)))
                        dismiss()
                    }.disabled(name.isEmpty)
                }
            }
        }
    }
}

private struct CopyMealView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var session: FuelwiseSession
    @State private var sourceDate: Date
    @State private var sourceMealType: String
    @State private var preview: [FuelwiseCloudFood] = []
    @State private var isLoading = true
    @State private var isCopying = false
    @State private var showExistingMealConfirmation = false
    @State private var errorMessage: String?

    let destination: CopyMealDestination
    let onCopied: () async -> Void

    private let mealTypes = ["breakfast", "lunch", "dinner", "snacks"]

    init(destination: CopyMealDestination, onCopied: @escaping () async -> Void) {
        self.destination = destination
        self.onCopied = onCopied
        let priorDay = Calendar.current.date(byAdding: .day, value: -1, to: destination.date) ?? destination.date
        _sourceDate = State(initialValue: priorDay)
        _sourceMealType = State(initialValue: destination.mealType)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Copy from") {
                    DatePicker("Date", selection: $sourceDate, in: ...Date(), displayedComponents: .date)
                    Picker("Meal", selection: $sourceMealType) {
                        ForEach(mealTypes, id: \.self) { value in
                            Text(value.capitalized).tag(value)
                        }
                    }
                }

                Section("Copy into") {
                    LabeledContent("Date", value: destination.date.formatted(date: .abbreviated, time: .omitted))
                    LabeledContent("Meal", value: destination.title)
                }

                Section("Preview") {
                    if isLoading {
                        HStack { Spacer(); ProgressView(); Spacer() }
                    } else if preview.isEmpty {
                        ContentUnavailableView("No foods in this meal", systemImage: "fork.knife")
                    } else {
                        ForEach(preview) { food in
                            HStack {
                                VStack(alignment: .leading, spacing: 3) {
                                    Text(food.name)
                                    Text(food.detail).font(.caption).foregroundStyle(.secondary)
                                }
                                Spacer()
                                Text("\(food.calories) kcal").font(.subheadline.weight(.semibold))
                            }
                        }
                        LabeledContent("Total", value: "\(preview.reduce(0) { $0 + $1.calories }) kcal")
                            .fontWeight(.semibold)
                    }
                }

                if destination.existingItemCount > 0 {
                    Section {
                        Label("\(destination.title) already has \(destination.existingItemCount) item\(destination.existingItemCount == 1 ? "" : "s"). Copied foods will be added to them.", systemImage: "exclamationmark.triangle")
                            .foregroundStyle(.orange)
                    }
                }

                if sameSourceAndDestination {
                    Section {
                        Text("Choose a different date or meal so Fuelwise doesn’t copy a meal onto itself.")
                            .foregroundStyle(.secondary)
                    }
                }

                if let errorMessage {
                    Section { Text(errorMessage).foregroundStyle(.red) }
                }
            }
            .navigationTitle("Copy meal")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button(isCopying ? "Copying…" : "Copy") {
                        if destination.existingItemCount > 0 {
                            showExistingMealConfirmation = true
                        } else {
                            copyMeal()
                        }
                    }
                    .disabled(isCopying || isLoading || preview.isEmpty || sameSourceAndDestination)
                }
            }
            .confirmationDialog(
                "Add to existing \(destination.title.lowercased())?",
                isPresented: $showExistingMealConfirmation,
                titleVisibility: .visible
            ) {
                Button("Copy \(preview.count) food\(preview.count == 1 ? "" : "s")") { copyMeal() }
                Button("Cancel", role: .cancel) { }
            } message: {
                Text("This keeps the foods already logged and adds the copied meal.")
            }
            .task(id: previewKey) { await loadPreview() }
        }
    }

    private var previewKey: String {
        "\(FuelwiseDayFormatter.isoDay(from: sourceDate))-\(sourceMealType)"
    }

    private var sameSourceAndDestination: Bool {
        FuelwiseDayFormatter.isoDay(from: sourceDate) == FuelwiseDayFormatter.isoDay(from: destination.date)
            && sourceMealType == destination.mealType
    }

    private func loadPreview() async {
        await MainActor.run {
            isLoading = true
            errorMessage = nil
        }
        do {
            guard let api = session.api else { throw FuelwiseError.notConfigured }
            let foods = try await api.meal(date: sourceDate, mealType: sourceMealType)
            await MainActor.run { preview = foods; isLoading = false }
        } catch {
            await MainActor.run { preview = []; isLoading = false; errorMessage = error.localizedDescription }
        }
    }

    private func copyMeal() {
        isCopying = true
        errorMessage = nil
        Task {
            do {
                guard let api = session.api else { throw FuelwiseError.notConfigured }
                try await api.copyMeal(
                    from: sourceDate,
                    sourceMealType: sourceMealType,
                    to: destination.date,
                    destinationMealType: destination.mealType
                )
                await onCopied()
                await MainActor.run { isCopying = false; dismiss() }
            } catch {
                await MainActor.run { isCopying = false; errorMessage = error.localizedDescription }
            }
        }
    }
}

private struct WeeklyAnalysis: Codable {
    let averageConsumed: Int
    let estimatedMetabolism: Int
    let averageActiveBurn: Int
    let loggedDays: Int
    let healthDays: Int
    let weightLb: Double?
    let bodyFat: Double?

    var dailyBalance: Int { averageConsumed - estimatedMetabolism - averageActiveBurn }
    var hasEnoughData: Bool { loggedDays >= 4 && healthDays >= 4 }
    var calorieDelta: Int {
        guard hasEnoughData else { return 0 }
        if dailyBalance < -750 { return 100 }
        if dailyBalance > 100 { return -100 }
        return 0
    }
    var recommendation: String {
        guard hasEnoughData else { return "Keep logging before changing targets" }
        if calorieDelta > 0 { return "Add 100 calories to moderate the estimated deficit" }
        if calorieDelta < 0 { return "Reduce 100 calories and reassess next week" }
        return "Keep calorie and macro targets steady"
    }
}

private struct CachedWeeklyAnalysis: Codable {
    let day: String
    let analysis: WeeklyAnalysis
}

private struct WeeklyCheckInView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var session: FuelwiseSession
    @State private var weight = ""
    @State private var saving = false
    @State private var errorMessage: String?
    @State private var analysis: WeeklyAnalysis?
    @State private var loading = true
    let calorieTarget: Int
    let proteinTarget: Int
    let onSave: (Double, Double?, String, Int) async throws -> Void

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    Text("7-DAY ENERGY ANALYSIS").font(.caption.weight(.bold)).tracking(1).foregroundStyle(.indigo)
                    Text("Your check-in separates what you ate, what your body likely uses at rest, and what Apple Health recorded from movement.")
                        .font(.subheadline).foregroundStyle(.secondary)

                    if loading {
                        VStack(spacing: 12) {
                            ProgressView()
                            Text("Analyzing the last 7 days…").font(.subheadline).foregroundStyle(.secondary)
                        }
                        .frame(maxWidth: .infinity).padding(.vertical, 44)
                    } else if let analysis {
                        Label("Calculated today", systemImage: "checkmark.circle.fill")
                            .font(.caption.weight(.semibold)).foregroundStyle(.secondary)
                        factorCard("Calories consumed", value: analysis.averageConsumed, detail: "Daily average · \(analysis.loggedDays) of 7 days logged", color: .indigo, icon: "fork.knife")
                        factorCard("Estimated metabolism", value: analysis.estimatedMetabolism, detail: "Estimated resting needs from weight and body fat", color: .orange, icon: "flame.fill")
                        factorCard("Exercise & activity", value: analysis.averageActiveBurn, detail: "Daily active-energy average from Apple Health", color: .mint, icon: "figure.run")

                        VStack(alignment: .leading, spacing: 12) {
                            HStack {
                                Text("Estimated daily balance").font(.headline)
                                Spacer()
                                Text(analysis.dailyBalance == 0 ? "0 kcal" : "\(analysis.dailyBalance > 0 ? "+" : "")\(analysis.dailyBalance) kcal")
                                    .font(.title3.bold()).foregroundStyle(analysis.dailyBalance < 0 ? .indigo : .orange)
                            }
                            Text("Consumed − metabolism − exercise/activity")
                                .font(.caption).foregroundStyle(.secondary)
                            Divider()
                            Text(analysis.recommendation).font(.headline)
                            Text(analysis.hasEnoughData ? "This is an estimate, so Fuelwise favors small adjustments and another week of observation." : "Log food and wear your Apple Watch or carry your iPhone on at least four days before changing the plan.")
                                .font(.subheadline).foregroundStyle(.secondary)
                        }
                        .padding(18).background(Color.indigo.opacity(0.08), in: RoundedRectangle(cornerRadius: 20))

                        VStack(alignment: .leading, spacing: 8) {
                            Text("Today’s weight").font(.headline)
                            HStack {
                                TextField("Weight", text: $weight).keyboardType(.decimalPad)
                                Text("lb").foregroundStyle(.secondary)
                            }
                            .padding(12).background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 12))
                        }

                        Button(saving ? "Saving…" : "Complete check-in") { complete(analysis) }
                            .buttonStyle(.borderedProminent).controlSize(.large).frame(maxWidth: .infinity)
                            .disabled(saving || !analysis.hasEnoughData)
                    } else {
                        ContentUnavailableView("Analysis unavailable", systemImage: "exclamationmark.triangle", description: Text(errorMessage ?? "Fuelwise couldn’t load this week’s data."))
                    }

                    if let errorMessage, analysis != nil { Text(errorMessage).font(.footnote).foregroundStyle(.red) }
                    Text("Energy expenditure and body-composition estimates are directional, not medical measurements.")
                        .font(.caption2).foregroundStyle(.tertiary)
                }
                .padding(20)
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("Weekly check-in")
            .task { await loadAnalysis() }
        }
    }

    private func factorCard(_ title: String, value: Int, detail: String, color: Color, icon: String) -> some View {
        HStack(spacing: 14) {
            Image(systemName: icon).font(.title2).foregroundStyle(color).frame(width: 34)
            VStack(alignment: .leading, spacing: 3) {
                Text(title).font(.headline)
                Text(detail).font(.caption).foregroundStyle(.secondary)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 1) {
                Text(value.formatted()).font(.title3.bold())
                Text("kcal/day").font(.caption2).foregroundStyle(.secondary)
            }
        }
        .padding(16).background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 18))
    }

    private func loadAnalysis() async {
        await MainActor.run { loading = true; errorMessage = nil }
        if let cached = cachedAnalysisForToday() {
            await MainActor.run {
                analysis = cached
                if weight.isEmpty, let value = cached.weightLb { weight = String(format: "%.1f", value) }
                loading = false
            }
            return
        }
        do {
            var consumed: [Int] = []
            var health: [HealthSummary] = []
            for offset in 0..<7 {
                let date = Calendar.current.date(byAdding: .day, value: -offset, to: Date())!
                guard let api = session.api else { throw FuelwiseError.notConfigured }
                async let dashboard = api.load(date: date)
                async let healthDay = HealthEnergyService.summary(for: date)
                let day = try await dashboard
                let summary = try await healthDay
                if !day.foods.isEmpty { consumed.append(day.foods.reduce(0) { $0 + $1.calories }) }
                if summary.active > 0 || summary.resting > 0 { health.append(summary) }
            }
            let latest = health.first
            let metabolism: Int
            if let kg = latest?.weightKg, let bodyFat = latest?.bodyFatPercent {
                metabolism = Int((370 + 21.6 * kg * (1 - bodyFat / 100)).rounded())
            } else {
                metabolism = max(0, Int(Double(health.reduce(0) { $0 + $1.resting }) / Double(max(health.count, 1))))
            }
            let result = WeeklyAnalysis(
                averageConsumed: Int(Double(consumed.reduce(0, +)) / Double(max(consumed.count, 1))),
                estimatedMetabolism: metabolism,
                averageActiveBurn: Int(Double(health.reduce(0) { $0 + $1.active }) / Double(max(health.count, 1))),
                loggedDays: consumed.count,
                healthDays: health.count,
                weightLb: latest?.weightKg.map { $0 / 0.45359237 },
                bodyFat: latest?.bodyFatPercent
            )
            saveAnalysisForToday(result)
            await MainActor.run {
                analysis = result
                if weight.isEmpty, let value = result.weightLb { weight = String(format: "%.1f", value) }
                loading = false
            }
        } catch {
            await MainActor.run { loading = false; errorMessage = "Check Fuelwise sync and Apple Health permissions, then try again." }
        }
    }

    private func cachedAnalysisForToday() -> WeeklyAnalysis? {
        guard let data = UserDefaults.standard.data(forKey: "fuelwise.weeklyAnalysis"),
              let cached = try? JSONDecoder().decode(CachedWeeklyAnalysis.self, from: data),
              cached.day == todayKey else { return nil }
        return cached.analysis
    }

    private func saveAnalysisForToday(_ analysis: WeeklyAnalysis) {
        let cached = CachedWeeklyAnalysis(day: todayKey, analysis: analysis)
        if let data = try? JSONEncoder().encode(cached) {
            UserDefaults.standard.set(data, forKey: "fuelwise.weeklyAnalysis")
        }
    }

    private var todayKey: String {
        let formatter = DateFormatter()
        formatter.calendar = Calendar.current
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: Date())
    }

    private func complete(_ analysis: WeeklyAnalysis) {
        guard let value = Double(weight), value >= 70 else { errorMessage = "Enter a valid weight."; return }
        saving = true
        Task {
            do {
                try await onSave(value, analysis.bodyFat, analysis.recommendation, analysis.calorieDelta)
                await MainActor.run { saving = false; dismiss() }
            } catch {
                await MainActor.run { saving = false; errorMessage = "Couldn’t sync this check-in." }
            }
        }
    }
}
