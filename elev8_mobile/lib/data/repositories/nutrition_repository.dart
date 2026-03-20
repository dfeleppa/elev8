import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

enum NutritionGoal {
  loseWeight('lose_weight', 'Lose weight'),
  gainWeight('gain_weight', 'Gain weight'),
  maintain('maintain', 'Maintain weight'),
  bodyRecomp('body_recomp', 'Body recomp');

  final String id;
  final String label;
  const NutritionGoal(this.id, this.label);

  static NutritionGoal? fromString(String? value) =>
    values.firstWhereOrNull((e) => e.id == value);
}

extension on List<NutritionGoal> {
  NutritionGoal? firstWhereOrNull(bool Function(NutritionGoal) test) {
    for (var item in this) {
      if (test(item)) return item;
    }
    return null;
  }
}

class SelectedDateNotifier extends Notifier<DateTime> {
  @override
  DateTime build() => DateTime.now();

  void setDate(DateTime date) => state = date;
}

final selectedDateProvider = NotifierProvider<SelectedDateNotifier, DateTime>(SelectedDateNotifier.new);

final nutritionRepositoryProvider = Provider<NutritionRepository>((ref) {
  return NutritionRepository(Supabase.instance.client);
});

final nutritionDayProvider = FutureProvider.family<Map<String, dynamic>?, DateTime>((ref, date) async {
  final repo = ref.watch(nutritionRepositoryProvider);
  return repo.fetchNutritionDay(date);
});

final coachPlanStatusProvider = FutureProvider<CoachPlanStatus?>((ref) async {
  final repo = ref.watch(nutritionRepositoryProvider);
  return repo.fetchCoachPlanStatus();
});

class CoachPlanStatus {
  static const double kgToLbsRatio = 2.20462;
  static const int checkInDotsCount = 10; // 10-week visual indicator

  final bool hasPlan;
  final String? goalType;
  final double? startWeight; // kg
  final double? currentWeight; // kg
  final double? targetWeight; // kg
  final DateTime? effectiveDate;
  final DateTime? lastCheckInDate;
  final DateTime? nextCheckInDate;

  CoachPlanStatus({
    required this.hasPlan,
    this.goalType,
    this.startWeight,
    this.currentWeight,
    this.targetWeight,
    this.effectiveDate,
    this.lastCheckInDate,
    this.nextCheckInDate,
  });

  double? _convertKgToLbs(double? kg) => kg != null ? kg * kgToLbsRatio : null;

  double? get startWeightLbs => _convertKgToLbs(startWeight);
  double? get currentWeightLbs => _convertKgToLbs(currentWeight);
  double? get targetWeightLbs => _convertKgToLbs(targetWeight);

  String get goalLabel {
    return NutritionGoal.fromString(goalType)?.label ?? goalType ?? 'Unknown';
  }

  String get checkInLabel {
    final last = lastCheckInDate;
    if (last == null) return 'No check-ins yet';
    final diff = DateTime.now().difference(last).inDays;
    if (diff == 0) return 'Today';
    if (diff == 1) return 'Yesterday';
    return '$diff days ago';
  }

  List<bool> get checkInDots {
    if (lastCheckInDate == null) return List.filled(checkInDotsCount, false);
    final daysSinceEffective = effectiveDate != null
        ? DateTime.now().difference(effectiveDate!).inDays
        : 0;
    if (daysSinceEffective <= 0) return List.filled(checkInDotsCount, false);
    final completed = (daysSinceEffective / 7).floor().clamp(0, checkInDotsCount);
    return List.generate(checkInDotsCount, (i) => i < completed);
  }
}

class NutritionRepository {
  final SupabaseClient _client;

  NutritionRepository(this._client);

  String _formatDate(DateTime date) {
    return date.toIso8601String().split('T').first;
  }

  Future<Map<String, dynamic>?> fetchNutritionDay(DateTime date) async {
    final user = _client.auth.currentUser;
    if (user == null) return null;

    final dateStr = _formatDate(date);

    try {
      final response = await _client
          .from('nutrition_days')
          .select('*, nutrition_entries(*)')
          .eq('member_id', user.id)
          .eq('day_date', dateStr)
          .maybeSingle();

      return response;
    } catch (e) {
      return null;
    }
  }

  Future<void> addNutritionEntry({
    required DateTime date,
    required String mealType,
    required String name,
    required double quantity,
    required num? calories,
    required num? protein,
    required num? carbs,
    required num? fat,
  }) async {
    final user = _client.auth.currentUser;
    if (user == null) return;

    final dateStr = _formatDate(date);

    final response = await _client.from('nutrition_days').upsert({
      'member_id': user.id,
      'day_date': dateStr,
      'updated_at': DateTime.now().toIso8601String(),
    }, onConflict: 'member_id,day_date').select('id').single();

    final dayId = response['id'];

    await _client.from('nutrition_entries').insert({
      'member_id': user.id,
      'day_id': dayId,
      'meal_type': mealType,
      'entry_name': name,
      'quantity': quantity,
      'calories': calories,
      'protein': protein,
      'carbs': carbs,
      'fat': fat,
      'updated_at': DateTime.now().toIso8601String(),
    });
  }

  Future<void> deleteNutritionEntry(String entryId) async {
    await _client.from('nutrition_entries').delete().eq('id', entryId);
  }

  Future<void> updateEntryQuantity(String entryId, double newQuantity) async {
    final q = newQuantity < 0.01 ? 0.01 : newQuantity;
    await _client.from('nutrition_entries').update({
      'quantity': q,
      'updated_at': DateTime.now().toIso8601String(),
    }).eq('id', entryId);
  }

  Future<void> deleteMealEntries(DateTime date, String mealType) async {
    final user = _client.auth.currentUser;
    if (user == null) return;
    
    final dateStr = _formatDate(date);
    
    final dayResp = await _client.from('nutrition_days').select('id').eq('member_id', user.id).eq('day_date', dateStr).maybeSingle();
    if (dayResp == null) return;
    
    await _client.from('nutrition_entries').delete().eq('day_id', dayResp['id']).eq('meal_type', mealType);
  }

  Future<void> copyMealToDate(DateTime sourceDate, String mealType, DateTime targetDate, String targetMeal) async {
     final user = _client.auth.currentUser;
     if (user == null) return;

     final sourceDateStr = _formatDate(sourceDate);
     final targetDateStr = _formatDate(targetDate);

     final dayResp = await _client.from('nutrition_days').select('id, nutrition_entries(*)').eq('member_id', user.id).eq('day_date', sourceDateStr).maybeSingle();
     if (dayResp == null) return;

     final entriesToCopy = (dayResp['nutrition_entries'] as List<dynamic>).where((e) => e['meal_type'] == mealType).toList();
     if (entriesToCopy.isEmpty) return;

     final targetDayResp = await _client.from('nutrition_days').upsert({
      'member_id': user.id,
      'day_date': targetDateStr,
      'updated_at': DateTime.now().toIso8601String(),
     }, onConflict: 'member_id,day_date').select('id').single();

     final targetDayId = targetDayResp['id'];

     final insertions = entriesToCopy.map((entry) => {
        'member_id': user.id,
        'day_id': targetDayId,
        'meal_type': targetMeal,
        'entry_name': entry['entry_name'],
        'quantity': entry['quantity'],
        'calories': entry['calories'],
        'protein': entry['protein'],
        'carbs': entry['carbs'],
        'fat': entry['fat'],
        'updated_at': DateTime.now().toIso8601String(),
     }).toList();

     await _client.from('nutrition_entries').insert(insertions);
  }

  Future<List<Map<String, dynamic>>> fetchRecentFoods() async {
    final user = _client.auth.currentUser;
    if (user == null) return [];

    try {
      final response = await _client
          .from('nutrition_entries')
          .select('entry_name, calories, protein, carbs, fat, quantity')
          .eq('member_id', user.id)
          .order('created_at', ascending: false)
          .limit(400);

      final seen = <String>{};
      final results = <Map<String, dynamic>>[];

      for (var row in response as List<dynamic>) {
        final name = (row['entry_name'] as String?)?.trim() ?? '';
        if (name.isEmpty) continue;
        
        final key = name.toLowerCase();
        if (seen.contains(key)) continue;

        seen.add(key);
        results.add(row);
        
        if (results.length >= 30) break;
      }

      return results;
    } catch (_) {
      return [];
    }
  }

  Future<List<Map<String, dynamic>>> fetchMyFoods() async {
    final user = _client.auth.currentUser;
    if (user == null) return [];

    try {
      final response = await _client
        .from('nutrition_custom_foods')
        .select('id, name, calories, protein, carbs, fat, created_at')
        .eq('member_id', user.id)
        .order('created_at', ascending: false);

      return List<Map<String, dynamic>>.from(response);
    } catch (_) {
      return [];
    }
  }

  Future<void> addCustomFood({
    required String name,
    required num? calories,
    required num? protein,
    required num? carbs,
    required num? fat,
  }) async {
    final user = _client.auth.currentUser;
    if (user == null) return;

    await _client.from('nutrition_custom_foods').insert({
      'member_id': user.id,
      'name': name,
      'calories': calories,
      'protein': protein,
      'carbs': carbs,
      'fat': fat,
      'updated_at': DateTime.now().toIso8601String(),
    });
  }

  Future<void> deleteCustomFood(String id) async {
    await _client.from('nutrition_custom_foods').delete().eq('id', id);
  }

  Future<void> _updateWithTimestamp(String tableName, String id, Map<String, dynamic> fields) async {
    final user = _client.auth.currentUser;
    if (user == null) return;
    await _client.from(tableName).update({
      ...fields,
      'updated_at': DateTime.now().toIso8601String(),
    }).eq('id', id).eq('member_id', user.id);
  }

  Future<void> updateNutritionEntry(String id, Map<String, dynamic> fields) =>
    _updateWithTimestamp('nutrition_entries', id, fields);

  Future<void> updateCustomFood(String id, Map<String, dynamic> fields) =>
    _updateWithTimestamp('nutrition_custom_foods', id, fields);

  Future<CoachPlanStatus?> fetchCoachPlanStatus() async {
    final user = _client.auth.currentUser;
    if (user == null) return null;

    try {
      // Fetch plan, profile, and weight data in parallel
      final results = await Future.wait([
        _client
            .from('coach_nutrition_plans')
            .select('goal_type, target_weight_kg, effective_date, last_check_in_date, next_check_in_date, plan_payload')
            .eq('member_id', user.id)
            .order('effective_date', ascending: false)
            .limit(1)
            .maybeSingle(),
        _client.from('app_users').select('current_weight_kg').eq('id', user.id).maybeSingle(),
        _client
            .from('health_stat_entries')
            .select('value, entry_date')
            .eq('member_id', user.id)
            .eq('stat_key', 'body_weight')
            .order('entry_date', ascending: false)
            .limit(1)
            .maybeSingle(),
      ]);

      final planResp = results[0] as Map<String, dynamic>?;
      final profileResp = results[1] as Map<String, dynamic>?;
      final weightEntryResp = results[2] as Map<String, dynamic>?;

      if (planResp == null) {
        return CoachPlanStatus(hasPlan: false);
      }

      final planPayload = (planResp['plan_payload'] as Map<String, dynamic>?) ?? {};
      final startWeightKg = _numFrom(planPayload['weightKg']) ?? _numFrom(profileResp?['current_weight_kg']);
      final currentWeightKg = _numFrom(weightEntryResp?['value']) ??
          _numFrom(profileResp?['current_weight_kg']) ??
          startWeightKg;

      return CoachPlanStatus(
        hasPlan: true,
        goalType: planResp['goal_type'] as String?,
        startWeight: startWeightKg,
        currentWeight: currentWeightKg,
        targetWeight: _numFrom(planResp['target_weight_kg']),
        effectiveDate: planResp['effective_date'] != null
            ? DateTime.tryParse(planResp['effective_date'] as String)
            : null,
        lastCheckInDate: planResp['last_check_in_date'] != null
            ? DateTime.tryParse(planResp['last_check_in_date'] as String)
            : null,
        nextCheckInDate: planResp['next_check_in_date'] != null
            ? DateTime.tryParse(planResp['next_check_in_date'] as String)
            : null,
      );
    } catch (_) {
      return null;
    }
  }

  double? _numFrom(dynamic value) {
    if (value == null) return null;
    if (value is double) return value;
    if (value is int) return value.toDouble();
    if (value is num) return value.toDouble();
    return null;
  }
}
