import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../models/athlete_dashboard.dart';
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
