import SwiftUI

struct FuelwiseRootView: View {
    @EnvironmentObject private var session: FuelwiseSession

    var body: some View {
        Group {
            if let error = session.configurationError {
                ContentUnavailableView("Fuelwise isn’t configured", systemImage: "exclamationmark.triangle", description: Text(error))
            } else if let auth = session.auth {
                FuelwiseAuthGate(auth: auth)
            } else {
                ProgressView("Starting Fuelwise…")
            }
        }
    }
}

private struct FuelwiseAuthGate: View {
    @ObservedObject var auth: FuelwiseAuthService
    @AppStorage("fuelwise.onboardingComplete") private var onboardingComplete = false

    var body: some View {
        Group {
            if auth.isRestoring {
                ProgressView("Restoring your session…")
            } else if auth.isSignedIn, auth.memberId != nil {
                if onboardingComplete {
                    FuelwiseHomeView()
                } else {
                    FuelwiseOnboardingView {
                        withAnimation(.easeInOut) { onboardingComplete = true }
                    }
                }
            } else {
                FuelwiseAuthView(auth: auth)
            }
        }
    }
}

private enum NutritionGoal: String, CaseIterable, Identifiable {
    case lose = "Lose fat"
    case maintain = "Maintain weight"
    case gain = "Build muscle"
    var id: String { rawValue }
    var icon: String {
        switch self { case .lose: "arrow.down.right"; case .maintain: "equal"; case .gain: "arrow.up.right" }
    }
    var adjustment: Int {
        switch self { case .lose: -350; case .maintain: 0; case .gain: 250 }
    }
}

private enum ActivityLevel: String, CaseIterable, Identifiable {
    case light = "Lightly active"
    case moderate = "Moderately active"
    case very = "Very active"
    var id: String { rawValue }
    var detail: String {
        switch self {
        case .light: "Mostly seated, 1–2 workouts/week"
        case .moderate: "Regular movement, 3–4 workouts/week"
        case .very: "Active job or 5+ workouts/week"
        }
    }
    var multiplier: Double {
        switch self { case .light: 12.5; case .moderate: 14.0; case .very: 15.5 }
    }
}

struct FuelwiseOnboardingView: View {
    @AppStorage("fuelwise.firstName") private var storedName = "Daniel"
    @AppStorage("fuelwise.calorieTarget") private var storedCalories = 2250
    @AppStorage("fuelwise.proteinTarget") private var storedProtein = 175
    @State private var step = 0
    @State private var firstName = "Daniel"
    @State private var age = "35"
    @State private var heightFeet = "5"
    @State private var heightInches = "10"
    @State private var weight = "180"
    @State private var goal: NutritionGoal = .lose
    @State private var activity: ActivityLevel = .moderate
    let onComplete: () -> Void

    private let totalSteps = 5
    private var weightValue: Double { Double(weight) ?? 180 }
    private var calorieTarget: Int {
        max(1400, Int((weightValue * activity.multiplier).rounded() / 10) * 10 + goal.adjustment)
    }
    private var proteinTarget: Int { max(80, Int((weightValue * 0.9).rounded())) }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                HStack(spacing: 8) {
                    ForEach(0..<totalSteps, id: \.self) { index in
                        Capsule().fill(index <= step ? Color.indigo : Color.secondary.opacity(0.18)).frame(height: 5)
                    }
                }
                .padding(.horizontal, 24).padding(.top, 16)

                TabView(selection: $step) {
                    welcome.tag(0)
                    goals.tag(1)
                    bodyDetails.tag(2)
                    activityLevel.tag(3)
                    planSummary.tag(4)
                }
                .tabViewStyle(.page(indexDisplayMode: .never))
                .animation(.easeInOut, value: step)

                HStack(spacing: 12) {
                    if step > 0 { Button("Back") { step -= 1 }.buttonStyle(.bordered).controlSize(.large) }
                    Button(step == totalSteps - 1 ? "Start my plan" : "Continue") {
                        if step == totalSteps - 1 { finish() } else { step += 1 }
                    }
                    .buttonStyle(.borderedProminent).controlSize(.large).frame(maxWidth: .infinity)
                    .disabled(!canContinue)
                }
                .padding(24)
            }
            .tint(.indigo)
            .background(Color(.systemGroupedBackground))
        }
    }

    private var welcome: some View {
        OnboardingPage(icon: "leaf.fill", eyebrow: "WELCOME TO FUELWISE", title: "Nutrition coaching that adapts to you", subtitle: "Build a realistic plan, log food quickly, and make steady progress without guesswork.") {
            VStack(alignment: .leading, spacing: 8) {
                Text("What should we call you?").font(.headline)
                TextField("First name", text: $firstName).textContentType(.givenName).textFieldStyle(.roundedBorder)
            }
        }
    }

    private var goals: some View {
        OnboardingPage(icon: "target", eyebrow: "YOUR GOAL", title: "What are you working toward?", subtitle: "This sets the pace of your initial calorie plan. You can change it later.") {
            VStack(spacing: 12) {
                ForEach(NutritionGoal.allCases) { item in
                    ChoiceRow(title: item.rawValue, detail: goalDetail(item), icon: item.icon, selected: goal == item) { goal = item }
                }
            }
        }
    }

    private var bodyDetails: some View {
        OnboardingPage(icon: "figure.stand", eyebrow: "ABOUT YOU", title: "Let’s estimate your starting targets", subtitle: "These details stay on your device in this version of Fuelwise.") {
            VStack(spacing: 16) {
                field("Age", text: $age, suffix: "years")
                HStack { field("Height", text: $heightFeet, suffix: "ft"); field("", text: $heightInches, suffix: "in") }
                field("Current weight", text: $weight, suffix: "lb")
            }
            .keyboardType(.decimalPad)
        }
    }

    private var activityLevel: some View {
        OnboardingPage(icon: "figure.run", eyebrow: "ACTIVITY", title: "How active is a normal week?", subtitle: "Choose your usual level—not your best week.") {
            VStack(spacing: 12) {
                ForEach(ActivityLevel.allCases) { item in
                    ChoiceRow(title: item.rawValue, detail: item.detail, icon: "figure.walk", selected: activity == item) { activity = item }
                }
            }
        }
    }

    private var planSummary: some View {
        OnboardingPage(icon: "sparkles", eyebrow: "YOUR STARTING PLAN", title: "A simple target you can sustain", subtitle: "We’ll refine these numbers from your check-ins and weight trend.") {
            VStack(spacing: 14) {
                PlanMetric(value: "\(calorieTarget.formatted())", label: "daily calories", color: .indigo)
                HStack(spacing: 12) {
                    PlanMetric(value: "\(proteinTarget)g", label: "protein", color: .purple)
                    PlanMetric(value: "Weekly", label: "check-in", color: .mint)
                }
                Text("This is a coaching estimate, not medical advice. Adjust with a qualified professional if you have medical or dietary needs.")
                    .font(.caption).foregroundStyle(.secondary).padding(.top, 4)
            }
        }
    }

    private var canContinue: Bool {
        switch step {
        case 0: !firstName.trimmingCharacters(in: .whitespaces).isEmpty
        case 2: (Double(age) ?? 0) >= 13 && weightValue > 0
        default: true
        }
    }

    private func goalDetail(_ item: NutritionGoal) -> String {
        switch item { case .lose: "A moderate, sustainable calorie deficit"; case .maintain: "Improve habits while keeping weight steady"; case .gain: "A controlled surplus with protein support" }
    }

    private func field(_ title: String, text: Binding<String>, suffix: String) -> some View {
        VStack(alignment: .leading, spacing: 7) {
            if !title.isEmpty { Text(title).font(.subheadline.weight(.semibold)) }
            HStack { TextField("", text: text); Text(suffix).foregroundStyle(.secondary) }
                .padding(13).background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 12))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func finish() {
        storedName = firstName.trimmingCharacters(in: .whitespaces)
        storedCalories = calorieTarget
        storedProtein = proteinTarget
        onComplete()
    }
}

private struct OnboardingPage<Content: View>: View {
    let icon: String; let eyebrow: String; let title: String; let subtitle: String
    @ViewBuilder let content: Content
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                Image(systemName: icon).font(.system(size: 30, weight: .semibold)).foregroundStyle(.indigo)
                    .frame(width: 64, height: 64).background(Color.indigo.opacity(0.1), in: RoundedRectangle(cornerRadius: 20))
                VStack(alignment: .leading, spacing: 10) {
                    Text(eyebrow).font(.caption.weight(.bold)).tracking(1.2).foregroundStyle(.indigo)
                    Text(title).font(.system(size: 34, weight: .bold, design: .rounded))
                    Text(subtitle).font(.body).foregroundStyle(.secondary)
                }
                content
            }
            .padding(24).padding(.top, 22)
        }
    }
}

private struct ChoiceRow: View {
    let title: String; let detail: String; let icon: String; let selected: Bool; let action: () -> Void
    var body: some View {
        Button(action: action) {
            HStack(spacing: 14) {
                Image(systemName: icon).font(.title3).frame(width: 34).foregroundStyle(selected ? .white : .indigo)
                VStack(alignment: .leading, spacing: 3) { Text(title).font(.headline); Text(detail).font(.caption).foregroundStyle(selected ? .white.opacity(0.8) : .secondary) }
                Spacer(); Image(systemName: selected ? "checkmark.circle.fill" : "circle")
            }
            .foregroundStyle(selected ? .white : .primary).padding(16)
            .background(selected ? Color.indigo : Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 18))
        }.buttonStyle(.plain)
    }
}

private struct PlanMetric: View {
    let value: String; let label: String; let color: Color
    var body: some View {
        VStack(spacing: 5) { Text(value).font(.system(size: 29, weight: .bold, design: .rounded)); Text(label).font(.caption).foregroundStyle(.secondary) }
            .frame(maxWidth: .infinity).padding(20).background(color.opacity(0.1), in: RoundedRectangle(cornerRadius: 18))
    }
}
