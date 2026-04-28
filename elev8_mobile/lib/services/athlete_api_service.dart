import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';

import '../config/env.dart';
import '../models/athlete_dashboard.dart';
import '../models/programming_track.dart';

/// Mirrors the auth-header + base-URL pattern of [CoachApiService] so the
/// dashboard can call the same web API the browser does. Each endpoint was
/// updated in phase C.1 to accept Supabase Auth Bearer tokens via
/// `requireRequestUserContext` on the server.
class AthleteApiService {
  static String get _baseUrl => Env.webAppUrl;

  static String? get _accessToken =>
      Supabase.instance.client.auth.currentSession?.accessToken;

  static Map<String, String> get _headers => {
    'Content-Type': 'application/json',
    if (_accessToken != null) 'Authorization': 'Bearer $_accessToken',
  };

  static Never _throwApiError(String operation, http.Response resp) {
    debugPrint('[AthleteApi] $operation failed (${resp.statusCode}): ${resp.body}');
    throw Exception('$operation failed (HTTP ${resp.statusCode}).');
  }

  /// 35-day workout consistency grid + current streak.
  static Future<ConsistencySummary> fetchConsistency() async {
    final uri = Uri.parse('$_baseUrl/api/athlete/consistency');
    final resp = await http.get(uri, headers: _headers);
    if (resp.statusCode != 200) {
      _throwApiError('Load consistency', resp);
    }
    final body = jsonDecode(resp.body) as Map<String, dynamic>;
    return ConsistencySummary.fromJson(body);
  }

  /// Latest body composition + strength PRs.
  static Future<HealthStatsSnapshot> fetchHealthStats() async {
    final uri = Uri.parse('$_baseUrl/api/health-stats');
    final resp = await http.get(uri, headers: _headers);
    if (resp.statusCode != 200) {
      _throwApiError('Load health stats', resp);
    }
    final body = jsonDecode(resp.body) as Map<String, dynamic>;
    return HealthStatsSnapshot.fromJson(body);
  }

  /// All programming tracks the user can see. Backed by
  /// /api/programming/tracks (extended to bearer auth).
  static Future<List<ProgrammingTrack>> fetchTracks() async {
    final uri = Uri.parse('$_baseUrl/api/programming/tracks');
    final resp = await http.get(uri, headers: _headers);
    if (resp.statusCode != 200) {
      _throwApiError('Load tracks', resp);
    }
    final body = jsonDecode(resp.body) as Map<String, dynamic>;
    final list = (body['tracks'] as List<dynamic>?) ?? const [];
    return list
        .map((t) => ProgrammingTrack.fromJson(t as Map<String, dynamic>))
        .where((t) => t.isActive)
        .toList();
  }

  /// Workout for [date] on [trackId]. Built on top of
  /// /api/programming/week — we request a 7-day window starting at [date]
  /// and pull out the entry whose day_date matches. Returns null if the
  /// track has no programming for that day.
  static Future<ProgrammingDay?> fetchProgrammingDay({
    required String trackId,
    required DateTime date,
  }) async {
    final dateStr = _isoDate(date);
    final uri = Uri.parse(
      '$_baseUrl/api/programming/week?trackId=$trackId&startDate=$dateStr',
    );
    final resp = await http.get(uri, headers: _headers);
    if (resp.statusCode != 200) {
      _throwApiError('Load workout', resp);
    }
    final body = jsonDecode(resp.body) as Map<String, dynamic>;
    final days = (body['days'] as List<dynamic>?) ?? const [];
    if (days.isEmpty) return null;

    for (final raw in days) {
      final day = ProgrammingDay.fromJson(raw as Map<String, dynamic>);
      if (day.dayDate == dateStr) return day;
    }
    return null;
  }

  static String _isoDate(DateTime d) {
    final yyyy = d.year.toString().padLeft(4, '0');
    final mm = d.month.toString().padLeft(2, '0');
    final dd = d.day.toString().padLeft(2, '0');
    return '$yyyy-$mm-$dd';
  }
}
