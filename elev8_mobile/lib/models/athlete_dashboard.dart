/// DTOs for the athlete dashboard.
///
/// Hand-rolled to match the existing convention in `lib/models/`. Each
/// type is the minimal shape needed by one dashboard card.

enum ConsistencyDayStatus { empty, logged, pr }

class ConsistencyDay {
  final String date; // ISO date YYYY-MM-DD
  final ConsistencyDayStatus status;

  const ConsistencyDay({required this.date, required this.status});

  factory ConsistencyDay.fromJson(Map<String, dynamic> json) {
    final raw = (json['status'] as String?) ?? 'empty';
    final status = switch (raw) {
      'pr' => ConsistencyDayStatus.pr,
      'logged' => ConsistencyDayStatus.logged,
      _ => ConsistencyDayStatus.empty,
    };
    return ConsistencyDay(
      date: (json['date'] as String?) ?? '',
      status: status,
    );
  }
}

class ConsistencySummary {
  final int streak;
  final List<ConsistencyDay> days;

  const ConsistencySummary({required this.streak, required this.days});

  factory ConsistencySummary.fromJson(Map<String, dynamic> json) {
    return ConsistencySummary(
      streak: (json['streak'] as num?)?.toInt() ?? 0,
      days: ((json['days'] as List<dynamic>?) ?? [])
          .map((d) => ConsistencyDay.fromJson(d as Map<String, dynamic>))
          .toList(),
    );
  }
}

/// One numeric stat tile in the health-stats card (e.g. "Body Weight: 187 lb").
class HealthStat {
  final String key;
  final String label;
  final double? value;
  final String unit;

  const HealthStat({
    required this.key,
    required this.label,
    required this.value,
    required this.unit,
  });
}

class HealthStatsSnapshot {
  /// Body composition (body weight, body fat, lean mass).
  final List<HealthStat> body;

  /// Top strength PRs (back squat, bench, deadlift, etc.).
  final List<HealthStat> lifts;

  const HealthStatsSnapshot({required this.body, required this.lifts});

  bool get isEmpty => body.isEmpty && lifts.isEmpty;

  /// Parses the `{ stats: { [key]: { value, unit, entryDate } } }` shape
  /// returned by `/api/health-stats` into two lists keyed for the dashboard.
  factory HealthStatsSnapshot.fromJson(Map<String, dynamic> json) {
    final stats = (json['stats'] as Map<String, dynamic>?) ?? const {};

    HealthStat? readStat(String key, String label) {
      final raw = stats[key];
      if (raw is! Map) return null;
      final valueStr = raw['value']?.toString();
      if (valueStr == null || valueStr.isEmpty) return null;
      final value = double.tryParse(valueStr);
      if (value == null) return null;
      return HealthStat(
        key: key,
        label: label,
        value: value,
        unit: (raw['unit'] as String?) ?? '',
      );
    }

    final body = <HealthStat>[
      readStat('body_weight', 'Body Weight'),
      readStat('body_fat', 'Body Fat'),
      readStat('lean_body_mass', 'Lean Mass'),
    ].whereType<HealthStat>().toList();

    // Top three lifts most users care about. Falls back gracefully if any
    // are missing — the dashboard card just shows what we have.
    final lifts = <HealthStat>[
      readStat('back_squat', 'Back Squat'),
      readStat('bench_press', 'Bench Press'),
      readStat('deadlift', 'Deadlift'),
    ].whereType<HealthStat>().toList();

    return HealthStatsSnapshot(body: body, lifts: lifts);
  }
}
