import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../services/app_user_service.dart';
import '../../services/coach_api_service.dart';

enum NutritionGoal {
  loseWeight('lose_weight', 'Lose Weight'),
  gainWeight('gain_weight', 'Gain Weight'),
  maintain('maintain_weight', 'Maintain'),
  performanceReverse('performance_reverse_diet', 'Performance / Reverse');

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

final selectedDateProvider = NotifierProvider<SelectedDateNotifier, DateTime>(
  SelectedDateNotifier.new,
);

final nutritionRepositoryProvider = Provider<NutritionRepository>((ref) {
  return NutritionRepository(
    Supabase.instance.client,
    ref.read(appUserServiceProvider),
  );
});

final nutritionDayProvider =
    FutureProvider.family<Map<String, dynamic>?, DateTime>((ref, date) async {
      final repo = ref.watch(nutritionRepositoryProvider);
      return repo.fetchNutritionDay(date);
    });

final coachPlanStatusProvider = FutureProvider<CoachPlanStatus?>((ref) async {
  final repo = ref.watch(nutritionRepositoryProvider);
  return repo.fetchCoachPlanStatus();
});

class CoachPlanStatus {
  static const double lbsPerKg = 2.20462;
  static const int checkInDotsCount = 10;

  final bool hasPlan;
  final String? goalType;
  final double? startWeight; // lbs
  final double? currentWeight; // lbs
  final double? targetWeight; // lbs
  final double? bodyFatPercent;
  final double? estimatedMetabolism; // kcal/day
  final String? metabolismSource; // "formula" | "empirical"
  final DateTime? metabolismEstimatedAt;
  final double? targetCalories;
  final double? proteinGrams;
  final double? carbsGrams;
  final double? fatGrams;
  final DateTime? effectiveDate;
  final DateTime? lastCheckInDate;
  final DateTime? nextCheckInDate;

  CoachPlanStatus({
    required this.hasPlan,
    this.goalType,
    this.startWeight,
    this.currentWeight,
    this.targetWeight,
    this.bodyFatPercent,
    this.estimatedMetabolism,
    this.metabolismSource,
    this.metabolismEstimatedAt,
    this.targetCalories,
    this.proteinGrams,
    this.carbsGrams,
    this.fatGrams,
    this.effectiveDate,
    this.lastCheckInDate,
    this.nextCheckInDate,
  });

  bool get checkInDueToday => daysUntilCheckIn <= 0;

  bool get hasTargetWeightGoal =>
      goalType == NutritionGoal.loseWeight.id ||
      goalType == NutritionGoal.gainWeight.id;

  String get goalLabel {
    return NutritionGoal.fromString(goalType)?.label ??
        goalType ??
        'Plan Active';
  }

  double? get weightProgressPercent {
    if (!hasTargetWeightGoal) return null;
    if (startWeight == null || targetWeight == null || currentWeight == null) {
      return null;
    }
    final totalDelta = (startWeight! - targetWeight!).abs();
    if (totalDelta == 0) return 100;
    final progressed = (startWeight! - currentWeight!).abs();
    return (progressed / totalDelta * 100).clamp(0, 100);
  }

  int get daysUntilCheckIn {
    final timeline = _checkInTimeline;
    return timeline.daysUntilNext;
  }

  List<bool> get checkInDots {
    final timeline = _checkInTimeline;
    return List.generate(checkInDotsCount, (i) => i < timeline.filledBars);
  }

  _CheckInTimelineData get _checkInTimeline {
    final current = DateTime.now();
    final today = DateTime(current.year, current.month, current.day);
    final dayInMs = const Duration(days: 1).inMilliseconds;
    final baseLast = lastCheckInDate ?? effectiveDate;
    final baseNext = nextCheckInDate;

    DateTime? normalize(DateTime? value) {
      if (value == null) return null;
      return DateTime(value.year, value.month, value.day);
    }

    final parsedLast = normalize(baseLast);
    final parsedNext =
        normalize(baseNext) ?? parsedLast?.add(const Duration(days: 10));

    if (parsedLast != null && parsedNext != null) {
      final totalDays =
          ((parsedNext.millisecondsSinceEpoch -
                      parsedLast.millisecondsSinceEpoch) /
                  dayInMs)
              .round()
              .clamp(1, 10 * checkInDotsCount);
      final elapsedDays =
          ((today.millisecondsSinceEpoch - parsedLast.millisecondsSinceEpoch) /
                  dayInMs)
              .round()
              .clamp(0, totalDays);
      final filledBars = ((elapsedDays / totalDays) * checkInDotsCount)
          .floor()
          .clamp(0, checkInDotsCount);
      final daysUntilNext =
          ((parsedNext.millisecondsSinceEpoch - today.millisecondsSinceEpoch) /
                  dayInMs)
              .ceil()
              .clamp(0, 10);

      return _CheckInTimelineData(
        filledBars: filledBars,
        daysUntilNext: daysUntilNext,
      );
    }

    final epochDays = (today.millisecondsSinceEpoch / dayInMs).floor();
    final elapsedSinceLast = ((epochDays % 10) + 10) % 10;
    final filledBars = (elapsedSinceLast + 1).clamp(0, checkInDotsCount);

    return _CheckInTimelineData(
      filledBars: filledBars,
      daysUntilNext: (10 - filledBars).clamp(0, 10),
    );
  }
}

class _CheckInTimelineData {
  final int filledBars;
  final int daysUntilNext;

  const _CheckInTimelineData({
    required this.filledBars,
    required this.daysUntilNext,
  });
}

class NutritionRepository {
  final SupabaseClient _client;
  final AppUserService _appUsers;

  NutritionRepository(this._client, this._appUsers);

  /// Resolves the internal app_users.id for the signed-in user. Delegates
  /// to [AppUserService] which centralizes the supabase_auth_uid → email
  /// fallback and caches the row across repos.
  Future<String?> _resolveAppUserId() => _appUsers.currentId();

  String _formatDate(DateTime date) => date.toIso8601String().split('T').first;

  double? _parseNumeric(dynamic value) {
    if (value == null) return null;
    if (value is num) return value.toDouble();
    return double.tryParse(value.toString());
  }

  bool _areTargetsUnset(Map<String, dynamic> day) {
    return day['calorie_target'] == null &&
        day['protein_target'] == null &&
        day['carbs_target'] == null &&
        day['fat_target'] == null;
  }

  Future<Map<String, dynamic>?> _getCoachPlanTargets(
    String appUserId,
    String dateStr,
  ) async {
    try {
      final plan = await _client
          .from('coach_nutrition_plans')
          .select('target_calories, protein_grams, carbs_grams, fat_grams')
          .eq('member_id', appUserId)
          .lte('effective_date', dateStr)
          .order('effective_date', ascending: false)
          .limit(1)
          .maybeSingle();

      if (plan == null) return null;

      return {
        'calorie_target': _parseNumeric(plan['target_calories']),
        'protein_target': _parseNumeric(plan['protein_grams']),
        'carbs_target': _parseNumeric(plan['carbs_grams']),
        'fat_target': _parseNumeric(plan['fat_grams']),
      };
    } catch (e) {
      debugPrint('[NutritionRepo] _getCoachPlanTargets failed: $e');
      return null;
    }
  }

  Future<Map<String, dynamic>?> _ensureNutritionDay({
    required String appUserId,
    required DateTime date,
  }) async {
    final dateStr = _formatDate(date);

    try {
      final day = await _client
          .from('nutrition_days')
          .select(
            'id, day_date, calorie_target, protein_target, carbs_target, fat_target',
          )
          .eq('member_id', appUserId)
          .eq('day_date', dateStr)
          .maybeSingle();

      if (day == null) {
        final planTargets = await _getCoachPlanTargets(appUserId, dateStr);
        if (planTargets == null) return null;

        return await _client
            .from('nutrition_days')
            .upsert({
              'member_id': appUserId,
              'day_date': dateStr,
              ...planTargets,
              'updated_at': DateTime.now().toIso8601String(),
            }, onConflict: 'member_id,day_date')
            .select(
              'id, day_date, calorie_target, protein_target, carbs_target, fat_target',
            )
            .single();
      }

      if (_areTargetsUnset(day)) {
        final planTargets = await _getCoachPlanTargets(appUserId, dateStr);
        if (planTargets != null) {
          return await _client
              .from('nutrition_days')
              .update({
                ...planTargets,
                'updated_at': DateTime.now().toIso8601String(),
              })
              .eq('id', day['id'])
              .eq('member_id', appUserId)
              .select(
                'id, day_date, calorie_target, protein_target, carbs_target, fat_target',
              )
              .single();
        }
      }

      return Map<String, dynamic>.from(day);
    } catch (e) {
      debugPrint('[NutritionRepo] _ensureNutritionDay failed: $e');
      return null;
    }
  }

  Future<Map<String, dynamic>?> fetchNutritionDay(DateTime date) async {
    final appUserId = await _resolveAppUserId();
    if (appUserId == null) return null;

    try {
      await _ensureNutritionDay(appUserId: appUserId, date: date);
      final dateStr = _formatDate(date);
      return await _client
          .from('nutrition_days')
          .select('*, nutrition_entries(*)')
          .eq('member_id', appUserId)
          .eq('day_date', dateStr)
          .maybeSingle();
    } catch (e) {
      debugPrint('[NutritionRepo] fetchNutritionDay failed: $e');
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
    final appUserId = await _resolveAppUserId();
    if (appUserId == null) return;
    final dayResp =
        await _ensureNutritionDay(appUserId: appUserId, date: date) ??
        await _client
            .from('nutrition_days')
            .upsert({
              'member_id': appUserId,
              'day_date': _formatDate(date),
              'updated_at': DateTime.now().toIso8601String(),
            }, onConflict: 'member_id,day_date')
            .select(
              'id, day_date, calorie_target, protein_target, carbs_target, fat_target',
            )
            .single();
    final dayId = dayResp['id'];

    await _client.from('nutrition_entries').insert({
      'member_id': appUserId,
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
    final appUserId = await _resolveAppUserId();
    if (appUserId == null) return;
    // Defense-in-depth: scope the delete to this user. RLS should already
    // enforce this, but a misconfigured policy would otherwise allow a
    // cross-user IDOR.
    await _client
        .from('nutrition_entries')
        .delete()
        .eq('id', entryId)
        .eq('member_id', appUserId);
  }

  Future<void> updateEntryQuantity(String entryId, double newQuantity) async {
    final appUserId = await _resolveAppUserId();
    if (appUserId == null) return;
    final q = newQuantity < 0.01 ? 0.01 : newQuantity;
    // Defense-in-depth: scope the update to this user. RLS should already
    // enforce this, but a misconfigured policy would otherwise allow a
    // cross-user IDOR write.
    await _client
        .from('nutrition_entries')
        .update({'quantity': q, 'updated_at': DateTime.now().toIso8601String()})
        .eq('id', entryId)
        .eq('member_id', appUserId);
  }

  Future<void> updateNutritionEntry(
    String id,
    Map<String, dynamic> fields,
  ) async {
    final appUserId = await _resolveAppUserId();
    if (appUserId == null) return;
    await _client
        .from('nutrition_entries')
        .update({...fields, 'updated_at': DateTime.now().toIso8601String()})
        .eq('id', id)
        .eq('member_id', appUserId);
  }

  Future<void> deleteMealEntries(DateTime date, String mealType) async {
    final appUserId = await _resolveAppUserId();
    if (appUserId == null) return;
    final dateStr = _formatDate(date);
    final dayResp = await _client
        .from('nutrition_days')
        .select('id')
        .eq('member_id', appUserId)
        .eq('day_date', dateStr)
        .maybeSingle();
    if (dayResp == null) return;
    await _client
        .from('nutrition_entries')
        .delete()
        .eq('day_id', dayResp['id'])
        .eq('meal_type', mealType);
  }

  Future<void> copyMealToDate({
    required DateTime sourceDate,
    required String sourceMeal,
    required DateTime targetDate,
    required String targetMeal,
  }) async {
    final appUserId = await _resolveAppUserId();
    if (appUserId == null) return;
    final sourceStr = _formatDate(sourceDate);

    final dayResp = await _client
        .from('nutrition_days')
        .select('id, nutrition_entries(*)')
        .eq('member_id', appUserId)
        .eq('day_date', sourceStr)
        .maybeSingle();
    if (dayResp == null) return;

    final entriesToCopy = (dayResp['nutrition_entries'] as List<dynamic>)
        .where((e) => e['meal_type'] == sourceMeal)
        .toList();
    if (entriesToCopy.isEmpty) return;

    final targetDayResp =
        await _ensureNutritionDay(appUserId: appUserId, date: targetDate) ??
        await _client
            .from('nutrition_days')
            .upsert({
              'member_id': appUserId,
              'day_date': _formatDate(targetDate),
              'updated_at': DateTime.now().toIso8601String(),
            }, onConflict: 'member_id,day_date')
            .select('id')
            .single();

    final targetDayId = targetDayResp['id'];
    final insertions = entriesToCopy.map((entry) {
      return <String, dynamic>{
        'member_id': appUserId,
        'day_id': targetDayId,
        'meal_type': targetMeal,
        'entry_name': entry['entry_name'],
        'quantity': entry['quantity'],
        'calories': entry['calories'],
        'protein': entry['protein'],
        'carbs': entry['carbs'],
        'fat': entry['fat'],
        'updated_at': DateTime.now().toIso8601String(),
      };
    }).toList();

    await _client.from('nutrition_entries').insert(insertions);
  }

  // ---- Food Library ----

  Future<List<Map<String, dynamic>>> fetchRecentFoods({int limit = 40}) async {
    final appUserId = await _resolveAppUserId();
    if (appUserId == null) return [];
    try {
      // Over-fetch by ~8x to give the in-Dart dedupe enough variety to
      // hit `limit` unique names. The right long-term fix is a server-side
      // `DISTINCT ON (entry_name)` RPC, but until that exists this scales
      // the scan with the request rather than always paging 400 rows.
      final scanCap = (limit * 8).clamp(80, 400);
      final response = await _client
          .from('nutrition_entries')
          .select('entry_name, calories, protein, carbs, fat, quantity')
          .eq('member_id', appUserId)
          .order('created_at', ascending: false)
          .limit(scanCap);
      final seen = <String>{};
      final results = <Map<String, dynamic>>[];
      for (var row in response as List<dynamic>) {
        final name = (row['entry_name'] as String?)?.trim() ?? '';
        if (name.isEmpty) continue;
        final key = name.toLowerCase();
        if (seen.contains(key)) continue;
        seen.add(key);
        results.add(row);
        if (results.length >= limit) break;
      }
      return results;
    } catch (e) {
      debugPrint('[NutritionRepo] fetchRecentFoods failed: $e');
      return [];
    }
  }

  Future<List<Map<String, dynamic>>> fetchMyFoods({int limit = 100}) async {
    final appUserId = await _resolveAppUserId();
    if (appUserId == null) return [];
    try {
      // Cap at `limit` (default 100) so a power user with thousands of
      // saved custom foods doesn't blow up the round-trip or memory.
      final response = await _client
          .from('nutrition_custom_foods')
          .select('id, name, calories, protein, carbs, fat, created_at')
          .eq('member_id', appUserId)
          .order('created_at', ascending: false)
          .limit(limit);
      return List<Map<String, dynamic>>.from(response);
    } catch (e) {
      debugPrint('[NutritionRepo] fetchMyFoods failed: $e');
      return [];
    }
  }

  Future<Map<String, dynamic>?> addCustomFood({
    required String name,
    required num? calories,
    required num? protein,
    required num? carbs,
    required num? fat,
  }) async {
    final appUserId = await _resolveAppUserId();
    if (appUserId == null) return null;
    final response = await _client
        .from('nutrition_custom_foods')
        .insert({
          'member_id': appUserId,
          'name': name,
          'calories': calories,
          'protein': protein,
          'carbs': carbs,
          'fat': fat,
          'updated_at': DateTime.now().toIso8601String(),
        })
        .select()
        .single();
    return Map<String, dynamic>.from(response);
  }

  Future<void> updateCustomFood(String id, Map<String, dynamic> fields) async {
    final appUserId = await _resolveAppUserId();
    if (appUserId == null) return;
    await _client
        .from('nutrition_custom_foods')
        .update({...fields, 'updated_at': DateTime.now().toIso8601String()})
        .eq('id', id)
        .eq('member_id', appUserId);
  }

  Future<void> deleteCustomFood(String id) async {
    final appUserId = await _resolveAppUserId();
    if (appUserId == null) return;
    await _client
        .from('nutrition_custom_foods')
        .delete()
        .eq('id', id)
        .eq('member_id', appUserId);
  }

  // ---- USDA Search ----

  Future<List<Map<String, dynamic>>> searchUsdaFoods(String query) async {
    if (query.trim().length < 2) return [];
    if (_client.auth.currentUser == null) return [];
    try {
      final response = await _client.functions.invoke(
        'usda-food-search',
        body: {'query': query.trim()},
      );
      if (response.data != null) {
        final List<dynamic> results = response.data['results'] ?? [];
        return results.map((r) => Map<String, dynamic>.from(r)).toList();
      }
    } catch (e) {
      debugPrint('[NutritionRepo] searchUsdaFoods (edge function) failed: $e');
    }
    try {
      final session = _client.auth.currentSession;
      if (session == null) return [];
      final resp = await _client.rpc(
        'search_usda_foods',
        params: {'query_text': query.trim(), 'limit_count': 12},
      );
      return List<Map<String, dynamic>>.from(resp ?? []);
    } catch (e) {
      debugPrint('[NutritionRepo] searchUsdaFoods (rpc fallback) failed: $e');
    }
    return [];
  }

  // ---- Coach Plan ----

  CoachPlanStatus _coachPlanStatusFromLatestPlan(
    Map<String, dynamic>? latestPlan, {
    Map<String, dynamic>? profile,
    double? currentWeightOverride,
  }) {
    if (latestPlan == null) {
      return CoachPlanStatus(hasPlan: false);
    }

    final planPayload = Map<String, dynamic>.from(
      latestPlan['plan_payload'] as Map? ?? {},
    );

    final startWeight =
        _parseNumeric(planPayload['weightLbs']) ??
        (() {
          final weightKg = _parseNumeric(planPayload['weightKg']);
          return weightKg == null ? null : weightKg * CoachPlanStatus.lbsPerKg;
        })() ??
        (() {
          final weightKg = _parseNumeric(profile?['current_weight_kg']);
          return weightKg == null ? null : weightKg * CoachPlanStatus.lbsPerKg;
        })();

    final currentWeight =
        currentWeightOverride ??
        (() {
          final weightKg = _parseNumeric(profile?['current_weight_kg']);
          return weightKg == null ? null : weightKg * CoachPlanStatus.lbsPerKg;
        })() ??
        startWeight;

    return CoachPlanStatus(
      hasPlan: true,
      goalType: latestPlan['goal_type'] as String?,
      startWeight: startWeight,
      currentWeight: currentWeight,
      targetWeight: _parseNumeric(latestPlan['target_weight_lbs']),
      effectiveDate: latestPlan['effective_date'] != null
          ? DateTime.tryParse(latestPlan['effective_date'] as String)
          : null,
      lastCheckInDate: latestPlan['last_check_in_date'] != null
          ? DateTime.tryParse(latestPlan['last_check_in_date'] as String)
          : null,
      nextCheckInDate: latestPlan['next_check_in_date'] != null
          ? DateTime.tryParse(latestPlan['next_check_in_date'] as String)
          : null,
    );
  }

  Future<CoachPlanStatus?> _fetchCoachPlanStatusFromSupabase() async {
    final appUserId = await _resolveAppUserId();
    if (appUserId == null) return null;

    try {
      final plan = await _client
          .from('coach_nutrition_plans')
          .select(
            'goal_type, target_weight_lbs, effective_date, last_check_in_date, next_check_in_date, plan_payload',
          )
          .eq('member_id', appUserId)
          .lte('effective_date', _formatDate(DateTime.now()))
          .order('effective_date', ascending: false)
          .limit(1)
          .maybeSingle();

      final fallbackPlan =
          plan ??
          await _client
              .from('coach_nutrition_plans')
              .select(
                'goal_type, target_weight_lbs, effective_date, last_check_in_date, next_check_in_date, plan_payload',
              )
              .eq('member_id', appUserId)
              .order('effective_date', ascending: false)
              .limit(1)
              .maybeSingle();

      if (fallbackPlan == null) {
        return CoachPlanStatus(hasPlan: false);
      }

      final profile = await _client
          .from('app_users')
          .select('current_weight_kg')
          .eq('id', appUserId)
          .maybeSingle();

      final currentWeightEntry = await _client
          .from('health_stat_entries')
          .select('value, entry_date')
          .eq('member_id', appUserId)
          .eq('stat_key', 'body_weight')
          .order('entry_date', ascending: false)
          .limit(1)
          .maybeSingle();

      return _coachPlanStatusFromLatestPlan(
        fallbackPlan,
        profile: profile,
        currentWeightOverride: _parseNumeric(currentWeightEntry?['value']),
      );
    } catch (e) {
      debugPrint('[NutritionRepo] _fetchCoachPlanStatusFromSupabase failed: $e');
      return null;
    }
  }

  Future<CoachPlanStatus?> fetchCoachPlanStatus() async {
    try {
      final response = await CoachApiService.fetchCoachPlanStatus();
      final summary = response.summary;
      if (!response.hasPlan || summary == null) {
        final existingPlan = await CoachApiService.fetchExistingPlan();
        return _coachPlanStatusFromLatestPlan(
          existingPlan.latestPlan,
          profile: existingPlan.profile,
        );
      }

      DateTime? parseDate(dynamic v) =>
          v is String ? DateTime.tryParse(v) : null;

      return CoachPlanStatus(
        hasPlan: true,
        goalType: summary['goalType'] as String?,
        startWeight: _parseNumeric(summary['startWeight']),
        currentWeight: _parseNumeric(summary['currentWeight']),
        targetWeight: _parseNumeric(summary['targetWeight']),
        bodyFatPercent: _parseNumeric(summary['bodyFatPercent']),
        estimatedMetabolism: _parseNumeric(summary['estimatedMetabolism']),
        metabolismSource: summary['metabolismSource'] as String?,
        metabolismEstimatedAt: parseDate(summary['metabolismEstimatedAt']),
        targetCalories: _parseNumeric(summary['targetCalories']),
        proteinGrams: _parseNumeric(summary['proteinGrams']),
        carbsGrams: _parseNumeric(summary['carbsGrams']),
        fatGrams: _parseNumeric(summary['fatGrams']),
        effectiveDate: parseDate(summary['effectiveDate']),
        lastCheckInDate: parseDate(summary['lastCheckInDate']),
        nextCheckInDate: parseDate(summary['nextCheckInDate']),
      );
    } catch (e) {
      debugPrint('[NutritionRepo] fetchCoachPlanStatus (API) failed, falling back to Supabase: $e');
      return _fetchCoachPlanStatusFromSupabase();
    }
  }

  Future<void> updateCoachGoal(String goalType) async {
    await CoachApiService.updateCoachGoal(goalType);
  }

  Future<void> updateDayTargets({
    required DateTime date,
    required num? calorieTarget,
    required num? proteinTarget,
    required num? carbsTarget,
    required num? fatTarget,
  }) async {
    final appUserId = await _resolveAppUserId();
    if (appUserId == null) return;
    final dateStr = _formatDate(date);
    await _client.from('nutrition_days').upsert({
      'member_id': appUserId,
      'day_date': dateStr,
      'calorie_target': calorieTarget,
      'protein_target': proteinTarget,
      'carbs_target': carbsTarget,
      'fat_target': fatTarget,
      'updated_at': DateTime.now().toIso8601String(),
    }, onConflict: 'member_id,day_date');
  }
}
