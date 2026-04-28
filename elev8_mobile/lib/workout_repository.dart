import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'services/app_user_service.dart';

final workoutRepositoryProvider = Provider<WorkoutRepository>((ref) {
  return WorkoutRepository(
    Supabase.instance.client,
    ref.read(appUserServiceProvider),
  );
});

final todaysProgrammingProvider = FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final repo = ref.watch(workoutRepositoryProvider);
  return repo.fetchTodaysProgramming();
});

class WorkoutRepository {
  final SupabaseClient _client;
  final AppUserService _appUsers;

  WorkoutRepository(this._client, this._appUsers);

  Future<List<Map<String, dynamic>>> fetchTodaysProgramming() async {
    final appUserId = await _appUsers.currentId();
    if (appUserId == null) return [];

    try {
      final membershipResponse = await _client
          .from('organization_memberships')
          .select('organization_id')
          .eq('user_id', appUserId)
          .maybeSingle();

      if (membershipResponse == null) return [];

      final orgId = membershipResponse['organization_id'] as String;

      final todayStr = DateTime.now().toIso8601String().split('T').first;

      final programmingDays = await _client
          .from('programming_days')
          .select('id, title, notes')
          .eq('organization_id', orgId)
          .eq('day_date', todayStr)
          .eq('is_published', true);

      if (programmingDays.isEmpty) return [];

      final dayId = programmingDays.first['id'] as String;

      final blocksResponse = await _client
          .from('workout_blocks')
          .select('id, title, description, block_type, score_type, block_order')
          .eq('programming_day_id', dayId)
          .order('block_order', ascending: true);

      return List<Map<String, dynamic>>.from(blocksResponse);
    } catch (e) {
      return [];
    }
  }
}
