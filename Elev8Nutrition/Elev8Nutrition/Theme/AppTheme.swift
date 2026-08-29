import SwiftUI

enum AppTheme {
    static let cyan = Color(red: 0.39, green: 0.97, blue: 1.0)
    static let pink = Color(red: 1.0, green: 0.69, blue: 0.77)
    static let orange = Color(red: 1.0, green: 0.72, blue: 0.38)
    static let protein = cyan
    static let carbs = orange
    static let fat = pink
    static let calories = Color.primary

    static func remainingColor(value: Double, hasTarget: Bool) -> Color {
        guard hasTarget else { return .secondary }
        return value >= 0 ? cyan : pink
    }
}

extension Double {
    var wholeString: String {
        let rounded = rounded()
        return rounded.formatted(.number.precision(.fractionLength(0)))
    }

    var macroString: String {
        if abs(self - rounded()) < 0.05 {
            return rounded().formatted(.number.precision(.fractionLength(0)))
        }
        return formatted(.number.precision(.fractionLength(1)))
    }
}
