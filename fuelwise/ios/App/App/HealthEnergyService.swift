import Foundation
import HealthKit

struct HealthSummary {
    let resting: Int
    let active: Int
    let weightKg: Double?
    let bodyFatPercent: Double?
    var total: Int { resting + active }
}

enum HealthEnergyService {
    private static let store = HKHealthStore()

    static func summary(for date: Date) async throws -> HealthSummary {
        guard HKHealthStore.isHealthDataAvailable(),
              let activeType = HKObjectType.quantityType(forIdentifier: .activeEnergyBurned),
              let restingType = HKObjectType.quantityType(forIdentifier: .basalEnergyBurned),
              let weightType = HKObjectType.quantityType(forIdentifier: .bodyMass),
              let bodyFatType = HKObjectType.quantityType(forIdentifier: .bodyFatPercentage) else {
            throw HealthEnergyError.unavailable
        }

        try await store.requestAuthorization(toShare: [], read: [activeType, restingType, weightType, bodyFatType])
        async let active = sum(activeType, on: date)
        async let resting = sum(restingType, on: date)
        async let weight = latest(weightType, before: date, unit: .gramUnit(with: .kilo))
        async let bodyFat = latest(bodyFatType, before: date, unit: .percent())
        return try await HealthSummary(
            resting: resting,
            active: active,
            weightKg: weight,
            bodyFatPercent: bodyFat.map { $0 * 100 }
        )
    }

    private static func sum(_ type: HKQuantityType, on date: Date) async throws -> Int {
        let calendar = Calendar.current
        let start = calendar.startOfDay(for: date)
        let end = calendar.date(byAdding: .day, value: 1, to: start)!
        let predicate = HKQuery.predicateForSamples(withStart: start, end: end, options: .strictStartDate)
        return try await withCheckedThrowingContinuation { continuation in
            let query = HKStatisticsQuery(quantityType: type, quantitySamplePredicate: predicate, options: .cumulativeSum) { _, result, error in
                if let error { continuation.resume(throwing: error); return }
                let calories = result?.sumQuantity()?.doubleValue(for: .kilocalorie()) ?? 0
                continuation.resume(returning: Int(calories.rounded()))
            }
            store.execute(query)
        }
    }

    private static func latest(_ type: HKQuantityType, before date: Date, unit: HKUnit) async throws -> Double? {
        let end = Calendar.current.date(byAdding: .day, value: 1, to: Calendar.current.startOfDay(for: date))!
        let predicate = HKQuery.predicateForSamples(withStart: nil, end: end, options: .strictEndDate)
        return try await withCheckedThrowingContinuation { continuation in
            let query = HKSampleQuery(sampleType: type, predicate: predicate, limit: 1, sortDescriptors: [NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: false)]) { _, samples, error in
                if let error { continuation.resume(throwing: error); return }
                let value = (samples?.first as? HKQuantitySample)?.quantity.doubleValue(for: unit)
                continuation.resume(returning: value)
            }
            store.execute(query)
        }
    }
}

private enum HealthEnergyError: Error { case unavailable }
