import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

final workoutRepositoryProvider = Provider<WorkoutRepository>((ref) {
  return WorkoutRepository(Supabase.instance.client);
});

final todaysProgrammingProvider = FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final repo = ref.watch(workoutRepositoryProvider);
  return repo.fetchTodaysProgramming();
});

class WorkoutRepository {
  final SupabaseClient _client;

  WorkoutRepository(this._client);

  Future<List<Map<String, dynamic>>> fetchTodaysProgramming() async {
    final user = _client.auth.currentUser;
    if (user == null) return [];

    try {
      // 1. Get the user's organization
      final membershipResponse = await _client
          .from('organization_memberships')
          .select('organization_id')
          .eq('user_id', user.id)
          .maybeSingle();

      if (membershipResponse == null) return [];
      
      final orgId = membershipResponse['organization_id'] as String;

      // 2. Format today's date
      final todayStr = DateTime.now().toIso8601String().split('T').first;

      // 3. Find today's programming day for the org
      final programmingDays = await _client
          .from('programming_days')
          .select('id, title, notes')
          .eq('organization_id', orgId)
          .eq('day_date', todayStr)
          .eq('is_published', true);

      if (programmingDays.isEmpty) return [];
      
      // Get the first available programming track for the day
      final dayId = programmingDays.first['id'] as String;

      // 4. Get the workout blocks for that day
      final blocksResponse = await _client
          .from('workout_blocks')
          .select('id, title, description, block_type, score_type, block_order')
          .eq('programming_day_id', dayId)
          .order('block_order', ascending: true);

      return List<Map<String, dynamic>>.from(blocksResponse);
    } catch (e) {
      // Handle the error (e.g., log it or surface to UI)
      return [];
    }
  }
}
