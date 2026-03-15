import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class SelectedDateNotifier extends Notifier<DateTime> {
  @override
  DateTime build() => DateTime.now();
}

final selectedDateProvider = NotifierProvider<SelectedDateNotifier, DateTime>(SelectedDateNotifier.new);

final nutritionRepositoryProvider = Provider<NutritionRepository>((ref) {
  return NutritionRepository(Supabase.instance.client);
});

final nutritionDayProvider = FutureProvider.family<Map<String, dynamic>?, DateTime>((ref, date) async {
  final repo = ref.watch(nutritionRepositoryProvider);
  return repo.fetchNutritionDay(date);
});

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
}
