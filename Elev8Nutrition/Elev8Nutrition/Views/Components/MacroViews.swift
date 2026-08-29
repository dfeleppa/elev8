import SwiftUI

struct MacroBar: View {
    let title: String
    let current: Double
    let target: Double?
    let color: Color

    private var progress: Double {
        guard let target, target > 0 else { return 0 }
        return min(max(current / target, 0), 1)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(title)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                Spacer()
                if let target {
                    Text("\(current.macroString) / \(target.macroString)g")
                        .font(.caption.monospacedDigit())
                } else {
                    Text("\(current.macroString)g")
                        .font(.caption.monospacedDigit())
                }
            }
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(Color.primary.opacity(0.08))
                    Capsule()
                        .fill(color)
                        .frame(width: max(6, geo.size.width * progress))
                }
            }
            .frame(height: 8)
        }
    }
}

struct RemainingChip: View {
    let label: String
    let remaining: Double
    let hasTarget: Bool
    let unit: String

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label)
                .font(.caption2.weight(.semibold))
                .foregroundStyle(.secondary)
            Text(hasTarget ? "\(remaining.macroString)\(unit)" : "—")
                .font(.system(.body, design: .rounded).weight(.bold).monospacedDigit())
                .foregroundStyle(AppTheme.remainingColor(value: remaining, hasTarget: hasTarget))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
    }
}

struct MacroField: View {
    let title: String
    let unit: String
    @Binding var text: String

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
            HStack {
                TextField("0", text: $text)
                    .keyboardType(.decimalPad)
                    .font(.body.monospacedDigit())
                Text(unit)
                    .foregroundStyle(.secondary)
                    .font(.caption)
            }
            .padding(12)
            .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        }
    }
}

enum MacroInput {
    static func parse(_ text: String) -> Double? {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty { return nil }
        return Double(trimmed.replacingOccurrences(of: ",", with: "."))
    }

    static func format(_ value: Double?) -> String {
        guard let value else { return "" }
        return value.macroString
    }
}
