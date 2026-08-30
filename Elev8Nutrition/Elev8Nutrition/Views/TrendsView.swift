import Charts
import SwiftUI

struct TrendsView: View {
    @EnvironmentObject private var store: NutritionStore

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    metabolismInsight
                    metabolismChart
                    weightChart
                    bodyFatChart
                    energyChart
                }
                .padding(.horizontal, 20)
                .padding(.bottom, 32)
            }
            .navigationTitle("Trends")
            .refreshable { await store.refreshAll() }
        }
    }

    private var metabolismInsight: some View {
        VStack(alignment: .leading, spacing: 12) {
            Label("Why this estimate", systemImage: "sparkles")
                .font(.headline)
                .foregroundStyle(AppTheme.cyan)

            if let current = store.metabolismHistory.first {
                HStack(alignment: .firstTextBaseline) {
                    Text(current.maintenanceCalories.wholeString)
                        .font(.system(size: 36, weight: .bold, design: .rounded))
                        .monospacedDigit()
                    Text("kcal/day")
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(.secondary)
                    Spacer()
                    Text(current.maintenanceCaloriesSource.capitalized)
                        .font(.caption.weight(.semibold))
                        .padding(.horizontal, 9)
                        .padding(.vertical, 5)
                        .background(AppTheme.cyan.opacity(0.12), in: Capsule())
                }

                VStack(alignment: .leading, spacing: 8) {
                    ForEach(metabolismExplanation, id: \.self) { line in
                        Label(line, systemImage: "circle.fill")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                            .labelStyle(InsightLabelStyle())
                    }
                }
            } else {
                Text("No maintenance estimate is available yet. Keep logging nutrition and body weight to build a useful trend.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(16)
        .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
    }

    private var metabolismChart: some View {
        trendCard(title: "Estimated maintenance", subtitle: "Plan history") {
            if metabolismPoints.isEmpty {
                emptyChart("No estimate history")
            } else {
                Chart(metabolismPoints) { estimate in
                    LineMark(
                        x: .value("Date", DayFormat.date(fromIso: estimate.effectiveDate)),
                        y: .value("Calories", estimate.maintenanceCalories)
                    )
                    .interpolationMethod(.catmullRom)
                    .foregroundStyle(AppTheme.cyan)
                    PointMark(
                        x: .value("Date", DayFormat.date(fromIso: estimate.effectiveDate)),
                        y: .value("Calories", estimate.maintenanceCalories)
                    )
                    .foregroundStyle(AppTheme.cyan)
                }
                .chartYScale(domain: paddedDomain(metabolismPoints.map(\.maintenanceCalories)))
                .trendAxes()
                .frame(height: 150)
            }
        }
    }

    private var weightChart: some View {
        trendCard(title: "Body weight", subtitle: latestText(weightPoints, unit: "lb")) {
            if weightPoints.isEmpty {
                emptyChart("No weight history")
            } else {
                Chart(weightPoints) { point in
                    LineMark(x: .value("Date", point.date), y: .value("Weight", point.value))
                        .interpolationMethod(.catmullRom)
                        .foregroundStyle(AppTheme.pink)
                    PointMark(x: .value("Date", point.date), y: .value("Weight", point.value))
                        .foregroundStyle(AppTheme.pink)
                }
                .chartYScale(domain: paddedDomain(weightPoints.map(\.value)))
                .trendAxes()
                .frame(height: 170)
            }
        }
    }

    private var bodyFatChart: some View {
        trendCard(title: "Body fat", subtitle: latestText(bodyFatPoints, unit: "%")) {
            if bodyFatPoints.isEmpty {
                emptyChart("No body-fat history")
            } else {
                Chart(bodyFatPoints) { point in
                    LineMark(x: .value("Date", point.date), y: .value("Body fat", point.value))
                        .interpolationMethod(.catmullRom)
                        .foregroundStyle(.orange)
                    PointMark(x: .value("Date", point.date), y: .value("Body fat", point.value))
                        .foregroundStyle(.orange)
                }
                .chartYScale(domain: paddedDomain(bodyFatPoints.map(\.value)))
                .trendAxes()
                .frame(height: 170)
            }
        }
    }

    private var energyChart: some View {
        trendCard(title: "Daily burn", subtitle: "Resting + active calories") {
            if energyDays.isEmpty {
                emptyChart("Sync Apple Health to build this trend")
            } else {
                Chart(energyDays) { day in
                    BarMark(
                        x: .value("Date", day.date),
                        y: .value("Calories", day.resting)
                    )
                    .foregroundStyle(by: .value("Energy", "Resting"))
                    BarMark(
                        x: .value("Date", day.date),
                        y: .value("Calories", day.active)
                    )
                    .foregroundStyle(by: .value("Energy", "Active"))
                }
                .chartForegroundStyleScale(["Resting": AppTheme.cyan, "Active": AppTheme.pink])
                .chartLegend(position: .bottom, alignment: .leading)
                .trendAxes()
                .frame(height: 190)
            }
        }
    }

    private var metabolismExplanation: [String] {
        guard let current = store.metabolismHistory.first else { return [] }
        var lines: [String] = []
        if let previous = store.metabolismHistory.dropFirst().first {
            let change = current.maintenanceCalories - previous.maintenanceCalories
            let direction = change < 0 ? "down" : "up"
            lines.append("The plan estimate moved \(direction) \(abs(change).wholeString) kcal/day on \(shortDate(current.effectiveDate)).")
        } else {
            lines.append("This is your first recorded maintenance estimate.")
        }
        if current.maintenanceCaloriesSource.lowercased() == "formula" {
            lines.append("It is formula-based, so plan inputs—not one day of Apple burn—set this number.")
        } else {
            lines.append("It uses your logged nutrition and body-weight trend, so consistent entries make it more reliable.")
        }
        if let change = changeAcross(weightPoints) {
            let direction = change < 0 ? "down" : "up"
            lines.append("Weight is \(direction) \(abs(change).macroString) lb across the available year of data.")
        }
        return lines
    }

    private var metabolismPoints: [MetabolismEstimate] {
        store.metabolismHistory.sorted { $0.effectiveDate < $1.effectiveDate }
    }

    private var weightPoints: [ChartPoint] { points(for: "body_weight") }
    private var bodyFatPoints: [ChartPoint] { points(for: "body_fat") }

    private var energyDays: [EnergyDay] {
        let active = Dictionary(uniqueKeysWithValues: points(for: "active_calories").map { ($0.day, $0.value) })
        let resting = Dictionary(uniqueKeysWithValues: points(for: "resting_calories").map { ($0.day, $0.value) })
        return Set(active.keys).union(resting.keys).sorted().map { day in
            EnergyDay(day: day, resting: resting[day] ?? 0, active: active[day] ?? 0)
        }
    }

    private func points(for statKey: String) -> [ChartPoint] {
        var latestByDay: [String: HealthTrendPoint] = [:]
        for point in store.healthHistory where point.statKey == statKey {
            latestByDay[point.entryDate] = point
        }
        return latestByDay.values
            .map { ChartPoint(day: $0.entryDate, value: $0.value) }
            .sorted { $0.day < $1.day }
    }

    private func changeAcross(_ points: [ChartPoint]) -> Double? {
        guard let first = points.first, let last = points.last, first.day != last.day else { return nil }
        return last.value - first.value
    }

    private func latestText(_ points: [ChartPoint], unit: String) -> String {
        guard let latest = points.last else { return "Last 12 months" }
        return "Latest \(latest.value.macroString) \(unit)"
    }

    private func paddedDomain(_ values: [Double]) -> ClosedRange<Double> {
        guard let low = values.min(), let high = values.max() else { return 0...1 }
        let padding = max((high - low) * 0.18, high * 0.015, 1)
        return (low - padding)...(high + padding)
    }

    private func shortDate(_ iso: String) -> String {
        DayFormat.date(fromIso: iso).formatted(.dateTime.month(.abbreviated).day())
    }

    private func trendCard<Content: View>(title: String, subtitle: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .firstTextBaseline) {
                Text(title).font(.headline)
                Spacer()
                Text(subtitle)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            content()
        }
        .padding(16)
        .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
    }

    private func emptyChart(_ message: String) -> some View {
        Text(message)
            .font(.subheadline)
            .foregroundStyle(.secondary)
            .frame(maxWidth: .infinity, minHeight: 90)
    }
}

private struct ChartPoint: Identifiable {
    let day: String
    let value: Double
    var id: String { day }
    var date: Date { DayFormat.date(fromIso: day) }
}

private struct EnergyDay: Identifiable {
    let day: String
    let resting: Double
    let active: Double
    var id: String { day }
    var date: Date { DayFormat.date(fromIso: day) }
}

private struct InsightLabelStyle: LabelStyle {
    func makeBody(configuration: Configuration) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            configuration.icon
                .font(.system(size: 5))
                .foregroundStyle(AppTheme.cyan)
            configuration.title
        }
    }
}

private extension View {
    func trendAxes() -> some View {
        chartXAxis {
            AxisMarks(values: .automatic(desiredCount: 4)) {
                AxisGridLine().foregroundStyle(.secondary.opacity(0.2))
                AxisValueLabel(format: .dateTime.month(.abbreviated).day())
            }
        }
        .chartYAxis {
            AxisMarks(position: .leading) {
                AxisGridLine().foregroundStyle(.secondary.opacity(0.2))
                AxisValueLabel()
            }
        }
    }
}
