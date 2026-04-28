// Programming track DTO. Matches the subset of fields we need on
// mobile from the /api/programming/tracks response.

class ProgrammingTrack {
  final String id;
  final String name;
  final String? code;
  final String? description;
  final bool isActive;
  final bool isPrivate;

  const ProgrammingTrack({
    required this.id,
    required this.name,
    required this.code,
    required this.description,
    required this.isActive,
    required this.isPrivate,
  });

  factory ProgrammingTrack.fromJson(Map<String, dynamic> json) {
    return ProgrammingTrack(
      id: json['id'] as String,
      name: (json['name'] as String?) ?? 'Untitled',
      code: json['code'] as String?,
      description: json['description'] as String?,
      isActive: (json['is_active'] as bool?) ?? true,
      isPrivate: (json['is_private'] as bool?) ?? false,
    );
  }
}

/// One workout block under a programming day. Matches the rows
/// `/api/programming/week` returns inside `days[].blocks[]`.
class WorkoutBlock {
  final String id;
  final int blockOrder;
  final String? blockType;
  final String? title;
  final String? description;
  final String? scoreType;
  final int? rounds;

  const WorkoutBlock({
    required this.id,
    required this.blockOrder,
    required this.blockType,
    required this.title,
    required this.description,
    required this.scoreType,
    required this.rounds,
  });

  factory WorkoutBlock.fromJson(Map<String, dynamic> json) {
    return WorkoutBlock(
      id: (json['id'] as String?) ?? '',
      blockOrder: (json['block_order'] as num?)?.toInt() ?? 0,
      blockType: json['block_type'] as String?,
      title: json['title'] as String?,
      description: json['description'] as String?,
      scoreType: json['score_type'] as String?,
      rounds: (json['rounds'] as num?)?.toInt(),
    );
  }
}

/// One programming day with its blocks.
class ProgrammingDay {
  final String id;
  final String dayDate; // ISO YYYY-MM-DD
  final String? title;
  final String? notes;
  final List<WorkoutBlock> blocks;

  const ProgrammingDay({
    required this.id,
    required this.dayDate,
    required this.title,
    required this.notes,
    required this.blocks,
  });

  factory ProgrammingDay.fromJson(Map<String, dynamic> json) {
    return ProgrammingDay(
      id: (json['id'] as String?) ?? '',
      dayDate: (json['day_date'] as String?) ?? '',
      title: json['title'] as String?,
      notes: json['notes'] as String?,
      blocks: ((json['blocks'] as List<dynamic>?) ?? [])
          .map((b) => WorkoutBlock.fromJson(b as Map<String, dynamic>))
          .toList()
        ..sort((a, b) => a.blockOrder.compareTo(b.blockOrder)),
    );
  }
}
