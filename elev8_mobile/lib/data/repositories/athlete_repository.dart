import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../models/athlete_dashboard.dart';
import '../../models/programming_track.dart';
import '../../services/athlete_api_service.dart';

/// 35-day consistency grid + current streak. Refresh by invalidating
/// this provider (the dashboard's pull-to-refresh does this).
final consistencySummaryProvider = FutureProvider<ConsistencySummary?>((ref) async {
  try {
    return await AthleteApiService.fetchConsistency();
  } catch (e) {
    debugPrint('[AthleteRepo] consistency fetch failed: $e');
    return null;
  }
});

/// Latest body comp + strength PRs.
final healthStatsProvider = FutureProvider<HealthStatsSnapshot?>((ref) async {
  try {
    return await AthleteApiService.fetchHealthStats();
  } catch (e) {
    debugPrint('[AthleteRepo] health stats fetch failed: $e');
    return null;
  }
});

/// All programming tracks the user can see.
final programmingTracksProvider = FutureProvider<List<ProgrammingTrack>>((ref) async {
  try {
    return await AthleteApiService.fetchTracks();
  } catch (e) {
    debugPrint('[AthleteRepo] tracks fetch failed: $e');
    return const [];
  }
});

/// Track the user has explicitly picked on the Workout screen, or null if
/// they haven't picked one yet. Persists for the session; not persisted
/// to disk yet.
class SelectedTrackNotifier extends Notifier<String?> {
  @override
  String? build() => null;
  void set(String? id) => state = id;
}

final selectedTrackProvider =
    NotifierProvider<SelectedTrackNotifier, String?>(SelectedTrackNotifier.new);

/// The track id we should actually be loading workouts for. Falls back to
/// the first available track if the user hasn't picked one or if their
/// previous pick is no longer in the available list.
final effectiveTrackIdProvider = Provider<String?>((ref) {
  final picked = ref.watch(selectedTrackProvider);
  final tracks = ref.watch(programmingTracksProvider).value;
  if (tracks == null || tracks.isEmpty) return null;
  if (picked != null && tracks.any((t) => t.id == picked)) {
    return picked;
  }
  return tracks.first.id;
});

/// Today's programming day for the effective track. Recomputes when
/// either the user changes the track or the available tracks list
/// changes.
final todaysWorkoutProvider = FutureProvider<ProgrammingDay?>((ref) async {
  final trackId = ref.watch(effectiveTrackIdProvider);
  if (trackId == null || trackId.isEmpty) return null;
  try {
    return await AthleteApiService.fetchProgrammingDay(
      trackId: trackId,
      date: DateTime.now(),
    );
  } catch (e) {
    debugPrint('[AthleteRepo] workout fetch failed: $e');
    return null;
  }
});
