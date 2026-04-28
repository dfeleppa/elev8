/// Programming track lookup nested inside a [OwnerScheduleClass].
class ScheduleTrack {
  final String id;
  final String? name;

  const ScheduleTrack({required this.id, required this.name});

  factory ScheduleTrack.fromJson(Map<String, dynamic> json) =>
      ScheduleTrack(id: json['id'].toString(), name: json['name'] as String?);
}

/// Default-coach lookup nested inside a [OwnerScheduleClass].
class ScheduleCoach {
  final String id;
  final String? fullName;
  final String? email;

  const ScheduleCoach({
    required this.id,
    required this.fullName,
    required this.email,
  });

  factory ScheduleCoach.fromJson(Map<String, dynamic> json) => ScheduleCoach(
    id: json['id'].toString(),
    fullName: json['full_name'] as String?,
    email: json['email'] as String?,
  );

  String get displayName {
    final n = (fullName ?? '').trim();
    if (n.isNotEmpty) return n;
    final mail = (email ?? '').trim();
    if (mail.isEmpty) return 'Unknown coach';
    final at = mail.indexOf('@');
    return at > 0 ? mail.substring(0, at) : mail;
  }
}

/// One row of the schedule_classes table, hydrated with its track and
/// default coach. Mirrors the JSON shape `/api/owner/schedule/classes`
/// returns.
class OwnerScheduleClass {
  final String id;
  final String name;
  final String classTime; // HH:MM 24h
  final int durationMinutes;
  final List<String> classDays; // Mo Tu We Th Fr Sa Su
  final String startDate; // YYYY-MM-DD
  final String? endDate;
  final int sizeLimit;
  final int reservationCutoffHours;
  final String calendarColor; // #RRGGBB
  final ScheduleTrack? track;
  final ScheduleCoach? defaultCoach;

  const OwnerScheduleClass({
    required this.id,
    required this.name,
    required this.classTime,
    required this.durationMinutes,
    required this.classDays,
    required this.startDate,
    required this.endDate,
    required this.sizeLimit,
    required this.reservationCutoffHours,
    required this.calendarColor,
    required this.track,
    required this.defaultCoach,
  });

  factory OwnerScheduleClass.fromJson(Map<String, dynamic> json) {
    int? parseInt(Object? v) {
      if (v == null) return null;
      if (v is int) return v;
      if (v is num) return v.toInt();
      return int.tryParse(v.toString());
    }

    final days = (json['class_days'] as List<dynamic>? ?? const [])
        .map((e) => e.toString())
        .toList();

    return OwnerScheduleClass(
      id: json['id'].toString(),
      name: (json['name'] as String?) ?? '',
      classTime: (json['class_time'] as String?) ?? '',
      durationMinutes: parseInt(json['duration_minutes']) ?? 0,
      classDays: days,
      startDate: (json['start_date'] as String?) ?? '',
      endDate: json['end_date'] as String?,
      sizeLimit: parseInt(json['size_limit']) ?? 0,
      reservationCutoffHours: parseInt(json['reservation_cutoff_hours']) ?? 0,
      calendarColor: (json['calendar_color'] as String?) ?? '#3B82F6',
      track: json['track'] is Map<String, dynamic>
          ? ScheduleTrack.fromJson(json['track'] as Map<String, dynamic>)
          : null,
      defaultCoach: json['default_coach'] is Map<String, dynamic>
          ? ScheduleCoach.fromJson(json['default_coach'] as Map<String, dynamic>)
          : null,
    );
  }
}
