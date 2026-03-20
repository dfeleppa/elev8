class WorkoutResult {
  final String id;
  final String organizationId;
  final String trackId;
  final String blockId;
  final DateTime dayDate;
  final String memberId;
  final int? level;
  final String scoreType;
  final String? scoreText;
  final double? scoreValue;
  final int? totalReps;
  final int? rounds;
  final double? distance;
  final int? calories;
  final int? durationSeconds;
  final bool isRx;
  final String? notes;
  final DateTime createdAt;
  final DateTime updatedAt;

  WorkoutResult({
    required this.id,
    required this.organizationId,
    required this.trackId,
    required this.blockId,
    required this.dayDate,
    required this.memberId,
    this.level,
    required this.scoreType,
    this.scoreText,
    this.scoreValue,
    this.totalReps,
    this.rounds,
    this.distance,
    this.calories,
    this.durationSeconds,
    required this.isRx,
    this.notes,
    required this.createdAt,
    required this.updatedAt,
  });

  factory WorkoutResult.fromJson(Map<String, dynamic> json) {
    return WorkoutResult(
      id: json['id'] as String,
      organizationId: json['organization_id'] as String,
      trackId: json['track_id'] as String,
      blockId: json['block_id'] as String,
      dayDate: DateTime.parse(json['day_date'] as String),
      memberId: json['member_id'] as String,
      level: json['level'] as int?,
      scoreType: json['score_type'] as String,
      scoreText: json['score_text'] as String?,
      scoreValue: json['score_value'] != null ? (json['score_value'] as num).toDouble() : null,
      totalReps: json['total_reps'] as int?,
      rounds: json['rounds'] as int?,
      distance: json['distance'] != null ? (json['distance'] as num).toDouble() : null,
      calories: json['calories'] as int?,
      durationSeconds: json['duration_seconds'] as int?,
      isRx: json['is_rx'] as bool? ?? false,
      notes: json['notes'] as String?,
      createdAt: DateTime.parse(json['created_at'] as String),
      updatedAt: DateTime.parse(json['updated_at'] as String),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'organization_id': organizationId,
      'track_id': trackId,
      'block_id': blockId,
      'day_date': dayDate.toIso8601String().substring(0, 10),
      'member_id': memberId,
      'level': level,
      'score_type': scoreType,
      'score_text': scoreText,
      'score_value': scoreValue,
      'total_reps': totalReps,
      'rounds': rounds,
      'distance': distance,
      'calories': calories,
      'duration_seconds': durationSeconds,
      'is_rx': isRx,
      'notes': notes,
      'created_at': createdAt.toIso8601String(),
      'updated_at': updatedAt.toIso8601String(),
    };
  }
}
