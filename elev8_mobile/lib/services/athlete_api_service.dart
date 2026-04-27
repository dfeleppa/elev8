import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';

import '../models/athlete_dashboard.dart';

/// Mirrors the auth-header + base-URL pattern of [CoachApiService] so the
/// dashboard can call the same web API the browser does. Each endpoint was
/// updated in phase C.1 to accept Supabase Auth Bearer tokens via
/// `requireRequestUserContext` on the server.
class AthleteApiService {
  static String get _baseUrl =>
      dotenv.env['WEB_APP_URL'] ?? 'https://www.daneff.com';

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
}
