import SwiftUI

struct TodayView: View {
    @EnvironmentObject private var store: NutritionStore
    @State private var showAdd = false
    @State private var showFastLog = false
    @State private var editing: NutritionEntry?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
                    dateNav
                    healthSummary
                    calorieHero
                    remainingRow
                    macroBars
                    meals
                }
                .padding(.horizontal, 20)
                .padding(.bottom, 32)
            }
            .refreshable { await store.refreshAll() }
            .navigationTitle("Today")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button {
                        showFastLog = true
                    } label: {
                        Image(systemName: "bolt.fill")
                    }
                    .accessibilityLabel("Fast log")
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showAdd = true
                    } label: {
                        Image(systemName: "plus.circle.fill")
                    }
                    .accessibilityLabel("Add entry")
                }
            }
            .sheet(isPresented: $showAdd) {
                EntryEditorView(mode: .add)
                    .environmentObject(store)
            }
            .sheet(isPresented: $showFastLog) {
                FastLogView()
                    .environmentObject(store)
            }
            .sheet(item: $editing) { entry in
                EntryEditorView(mode: .edit(entry))
                    .environmentObject(store)
            }
            .task(id: store.selectedDayISO) {
                await store.refreshDay()
            }
        }
    }

    private var dateNav: some View {
        HStack {
            Button { store.shiftDay(by: -1) } label: {
                Image(systemName: "chevron.left.circle.fill")
                    .font(.title2)
            }
            Spacer()
            Button(action: store.jumpToToday) {
                VStack(spacing: 2) {
                    Text(DayFormat.display(fromIso: store.selectedDayISO))
                        .font(.headline)
                    Text(store.selectedDayISO)
                        .font(.caption.monospacedDigit())
                        .foregroundStyle(.secondary)
                }
            }
            .buttonStyle(.plain)
            Spacer()
            Button { store.shiftDay(by: 1) } label: {
                Image(systemName: "chevron.right.circle.fill")
                    .font(.title2)
            }
        }
        .foregroundStyle(AppTheme.cyan)
        .padding(.top, 8)
    }

    private var calorieHero: some View {
        let target = store.day?.calorieTarget
        let remaining = target.map { $0 - store.totals.calories }
        return VStack(spacing: 6) {
            Text(store.totals.calories.wholeString)
                .font(.system(size: 64, weight: .bold, design: .rounded))
                .monospacedDigit()
                .minimumScaleFactor(0.5)
                .lineLimit(1)
            if let target {
                Text("of \(target.wholeString) kcal")
                    .font(.title3.weight(.medium))
                    .foregroundStyle(.secondary)
            } else {
                Text("kcal logged")
                    .font(.title3.weight(.medium))
                    .foregroundStyle(.secondary)
            }
            if let remaining {
                Text(remaining >= 0 ? "\(remaining.wholeString) remaining" : "\(abs(remaining).wholeString) over")
                    .font(.headline)
                    .foregroundStyle(AppTheme.remainingColor(value: remaining, hasTarget: true))
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 8)
    }

    private var healthSummary: some View {
        VStack(spacing: 10) {
            HStack(alignment: .center) {
                Label("Health", systemImage: "heart.fill")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(AppTheme.pink)
                Spacer()
                Button {
                    Task { await store.syncAppleHealth() }
                } label: {
                    if store.isSyncingHealth {
                        ProgressView()
                            .controlSize(.small)
                    } else {
                        Image(systemName: "arrow.triangle.2.circlepath")
                    }
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Sync Apple Health")
                .disabled(store.isSyncingHealth)
            }

            HStack(spacing: 0) {
                HealthSummaryMetric(
                    label: "Metabolism",
                    value: healthCalories(store.maintenanceCalories),
                    detail: store.metabolismSource?.capitalized
                )
                Divider().frame(height: 34)
                HealthSummaryMetric(
                    label: "Weight",
                    value: healthMeasurement(store.healthSnapshot.weightLbs, unit: "lb")
                )
                Divider().frame(height: 34)
                HealthSummaryMetric(
                    label: "Body fat",
                    value: healthMeasurement(store.healthSnapshot.bodyFatPercent, unit: "%")
                )
            }

            HStack(spacing: 12) {
                healthEnergyLabel("Rest", store.healthSnapshot.restingCalories)
                healthEnergyLabel("Active", store.healthSnapshot.activeCalories)
                Spacer(minLength: 0)
                healthEnergyLabel("Burn", store.healthSnapshot.estimatedBurn, emphasized: true)
            }
            .font(.caption2.monospacedDigit())
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    private func healthCalories(_ value: Double?) -> String {
        value.map { "\($0.wholeString) kcal" } ?? "—"
    }

    private func healthMeasurement(_ value: Double?, unit: String) -> String {
        value.map { "\($0.macroString) \(unit)" } ?? "—"
    }

    private func healthEnergyLabel(_ label: String, _ value: Double?, emphasized: Bool = false) -> some View {
        Text("\(label) \(value.map { $0.wholeString } ?? "—")")
            .foregroundStyle(emphasized ? AppTheme.cyan : .secondary)
    }

    private var remainingRow: some View {
        HStack(spacing: 10) {
            RemainingChip(label: "Protein", remaining: store.remaining.protein, hasTarget: store.day?.proteinTarget != nil, unit: "g")
            RemainingChip(label: "Carbs", remaining: store.remaining.carbs, hasTarget: store.day?.carbsTarget != nil, unit: "g")
            RemainingChip(label: "Fat", remaining: store.remaining.fat, hasTarget: store.day?.fatTarget != nil, unit: "g")
        }
    }

    private var macroBars: some View {
        VStack(spacing: 12) {
            MacroBar(title: "Protein", current: store.totals.protein, target: store.day?.proteinTarget, color: AppTheme.protein)
            MacroBar(title: "Carbs", current: store.totals.carbs, target: store.day?.carbsTarget, color: AppTheme.carbs)
            MacroBar(title: "Fat", current: store.totals.fat, target: store.day?.fatTarget, color: AppTheme.fat)
        }
        .padding(16)
        .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
    }

    private var meals: some View {
        VStack(spacing: 16) {
            ForEach(store.entries.groupedByMeal(), id: \.0) { meal, items in
                VStack(alignment: .leading, spacing: 10) {
                    HStack {
                        Label(meal.title, systemImage: meal.symbol)
                            .font(.headline)
                        Spacer()
                        Text("\(items.totals.calories.wholeString) kcal")
                            .font(.subheadline.monospacedDigit())
                            .foregroundStyle(.secondary)
                    }
                    if items.isEmpty {
                        Text("Nothing logged")
                            .font(.subheadline)
                            .foregroundStyle(.tertiary)
                            .padding(.vertical, 4)
                    } else {
                        ForEach(items) { entry in
                            Button {
                                editing = entry
                            } label: {
                                EntryRow(entry: entry)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
                .padding(16)
                .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
            }

            if let message = store.errorMessage {
                Text(message)
                    .font(.footnote)
                    .foregroundStyle(AppTheme.pink)
            }
        }
    }
}

private struct HealthSummaryMetric: View {
    let label: String
    let value: String
    var detail: String? = nil

    var body: some View {
        VStack(spacing: 2) {
            Text(label)
                .font(.caption2)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.subheadline.weight(.semibold).monospacedDigit())
                .lineLimit(1)
                .minimumScaleFactor(0.7)
            if let detail {
                Text(detail)
                    .font(.system(size: 9))
                    .foregroundStyle(.tertiary)
                    .lineLimit(1)
            }
        }
        .frame(maxWidth: .infinity)
    }
}

struct EntryRow: View {
    let entry: NutritionEntry

    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            VStack(alignment: .leading, spacing: 2) {
                Text(entry.entryName)
                    .font(.body.weight(.semibold))
                    .foregroundStyle(.primary)
                Text("qty \(entry.quantity.macroString)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                Text("\((entry.calories ?? 0).wholeString)")
                    .font(.body.weight(.semibold).monospacedDigit())
                Text("P \((entry.protein ?? 0).macroString)  C \((entry.carbs ?? 0).macroString)  F \((entry.fat ?? 0).macroString)")
                    .font(.caption2.monospacedDigit())
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 4)
    }
}
