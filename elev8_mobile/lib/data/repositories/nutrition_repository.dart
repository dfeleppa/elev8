import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

final nutritionRepositoryProvider = Provider<NutritionRepository>((ref) {
  return NutritionRepository(Supabase.instance.client);
});

final todaysNutritionProvider = FutureProvider<Map<String, dynamic>?>((ref) async {
  final repo = ref.watch(nutritionRepositoryProvider);
  return repo.fetchTodaysNutrition();
});

class NutritionRepository {
  final SupabaseClient _client;

  NutritionRepository(this._client);

  Future<Map<String, dynamic>?> fetchTodaysNutrition() async {
    final user = _client.auth.currentUser;
    if (user == null) return null;

    final todayStr = DateTime.now().toIso8601String().split('T').first;

    try {
      // Query the nutrition day and its associated entries in one go
      final response = await _client
          .from('nutrition_days')
          .select('*, nutrition_entries(*)')
          .eq('member_id', user.id)
          .eq('day_date', todayStr)
          .maybeSingle();

      return response;
    } catch (e) {
      // Return a mock object if error occurs, just for prototyping purposes
      // since there may be no actual rows for this user yet.
      return null;
    }
  }
}
