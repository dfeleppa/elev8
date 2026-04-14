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
  String? _cachedAppUserId;

  WorkoutRepository(this._client) {
    // Clear the cache on sign-out so a re-login resolves fresh.
    _client.auth.onAuthStateChange.listen((data) {
      if (data.event == AuthChangeEvent.signedOut) {
        _cachedAppUserId = null;
      }
    });
  }

  /// Resolves the internal app_users.id for the signed-in user.
  ///
  /// The web app creates app_users rows via NextAuth (no Supabase Auth), so
  /// app_users.id is a plain UUID unrelated to auth.uid().  The mobile app
  /// sets supabase_auth_uid on every login so we can bridge the two systems.
  Future<String?> _resolveAppUserId() async {
    if (_cachedAppUserId != null) return _cachedAppUserId;
    final authUser = _client.auth.currentUser;
    if (authUser == null) return null;
    try {
      final result = await _client
          .from('app_users')
          .select('id')
          .eq('supabase_auth_uid', authUser.id)
          .maybeSingle();
      _cachedAppUserId = result?['id'] as String?;
    } catch (_) {}
    return _cachedAppUserId;
  }

  Future<List<Map<String, dynamic>>> fetchTodaysProgramming() async {
    final appUserId = await _resolveAppUserId();
    if (appUserId == null) return [];

    try {
      // 1. Get the user's organization via the real app_users.id
      final membershipResponse = await _client
          .from('organization_memberships')
          .select('organization_id')
          .eq('user_id', appUserId)
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

      final dayId = programmingDays.first['id'] as String;

      // 4. Get the workout blocks for that day
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
