class NutritionDay {
  final String id;
  final DateTime dayDate;
  final String memberId;
  final double calorieTarget;
  final double proteinTarget;
  final double carbsTarget;
  final double fatTarget;
  final DateTime createdAt;
  final DateTime updatedAt;

  NutritionDay({
    required this.id,
    required this.dayDate,
    required this.memberId,
    required this.calorieTarget,
    required this.proteinTarget,
    required this.carbsTarget,
    required this.fatTarget,
    required this.createdAt,
    required this.updatedAt,
  });

  factory NutritionDay.fromJson(Map<String, dynamic> json) {
    return NutritionDay(
      id: json['id'] as String,
      dayDate: DateTime.parse(json['day_date'] as String),
      memberId: json['member_id'] as String,
      calorieTarget: (json['calorie_target'] as num? ?? 0).toDouble(),
      proteinTarget: (json['protein_target'] as num? ?? 0).toDouble(),
      carbsTarget: (json['carbs_target'] as num? ?? 0).toDouble(),
      fatTarget: (json['fat_target'] as num? ?? 0).toDouble(),
      createdAt: DateTime.parse(json['created_at'] as String),
      updatedAt: DateTime.parse(json['updated_at'] as String),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'day_date': dayDate.toIso8601String().substring(0, 10),
      'member_id': memberId,
      'calorie_target': calorieTarget,
      'protein_target': proteinTarget,
      'carbs_target': carbsTarget,
      'fat_target': fatTarget,
      'created_at': createdAt.toIso8601String(),
      'updated_at': updatedAt.toIso8601String(),
    };
  }
}

class NutritionEntry {
  final String id;
  final String dayId;
  final String memberId;
  final String mealType;
  final String entryName;
  final double quantity;
  final double calories;
  final double protein;
  final double carbs;
  final double fat;
  final DateTime createdAt;
  final DateTime updatedAt;

  NutritionEntry({
    required this.id,
    required this.dayId,
    required this.memberId,
    required this.mealType,
    required this.entryName,
    required this.quantity,
    required this.calories,
    required this.protein,
    required this.carbs,
    required this.fat,
    required this.createdAt,
    required this.updatedAt,
  });

  factory NutritionEntry.fromJson(Map<String, dynamic> json) {
    return NutritionEntry(
      id: json['id'] as String,
      dayId: json['day_id'] as String,
      memberId: json['member_id'] as String,
      mealType: json['meal_type'] as String,
      entryName: json['entry_name'] as String,
      quantity: (json['quantity'] as num? ?? 1.0).toDouble(),
      calories: (json['calories'] as num? ?? 0.0).toDouble(),
      protein: (json['protein'] as num? ?? 0.0).toDouble(),
      carbs: (json['carbs'] as num? ?? 0.0).toDouble(),
      fat: (json['fat'] as num? ?? 0.0).toDouble(),
      createdAt: DateTime.parse(json['created_at'] as String),
      updatedAt: DateTime.parse(json['updated_at'] as String),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'day_id': dayId,
      'member_id': memberId,
      'meal_type': mealType,
      'entry_name': entryName,
      'quantity': quantity,
      'calories': calories,
      'protein': protein,
      'carbs': carbs,
      'fat': fat,
      'created_at': createdAt.toIso8601String(),
      'updated_at': updatedAt.toIso8601String(),
    };
  }
}
