import 'dart:convert';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';

class CoachPlanPreview {
  final double maintenanceCalories;
  final double targetCalories;
  final double proteinGrams;
  final double carbsGrams;
  final double fatGrams;
  final double weeklyRatePercent;
  final String formulaUsed;
  final double activityMultiplier;

  CoachPlanPreview({
    required this.maintenanceCalories,
    required this.targetCalories,
    required this.proteinGrams,
    required this.carbsGrams,
    required this.fatGrams,
    required this.weeklyRatePercent,
    required this.formulaUsed,
    required this.activityMultiplier,
  });

  factory CoachPlanPreview.fromJson(Map<String, dynamic> json) {
    return CoachPlanPreview(
      maintenanceCalories: (json['maintenanceCalories'] as num).toDouble(),
      targetCalories: (json['targetCalories'] as num).toDouble(),
      proteinGrams: (json['proteinGrams'] as num).toDouble(),
      carbsGrams: (json['carbsGrams'] as num).toDouble(),
      fatGrams: (json['fatGrams'] as num).toDouble(),
      weeklyRatePercent: (json['weeklyRatePercent'] as num).toDouble(),
      formulaUsed: json['formulaUsed'] as String? ?? '',
      activityMultiplier:
          (json['activityMultiplier'] as num?)?.toDouble() ?? 1.0,
    );
  }
}

class ExistingPlanData {
  final Map<String, dynamic>? profile;
  final Map<String, dynamic>? latestPlan;
  final bool hasPlan;

  ExistingPlanData({
    required this.profile,
    required this.latestPlan,
    required this.hasPlan,
  });
}

class CoachPlanStatusResponse {
  final bool hasPlan;
  final Map<String, dynamic>? summary;

  CoachPlanStatusResponse({required this.hasPlan, required this.summary});
}

class CoachApiService {
  static String get _baseUrl =>
      dotenv.env['WEB_APP_URL'] ?? 'https://www.daneff.com';

  static String? get _accessToken =>
      Supabase.instance.client.auth.currentSession?.accessToken;

  static Map<String, String> get _headers => {
    'Content-Type': 'application/json',
    if (_accessToken != null) 'Authorization': 'Bearer $_accessToken',
  };

  /// Fetches existing plan data + member profile to pre-fill the setup wizard.
  static Future<ExistingPlanData> fetchExistingPlan() async {
    final uri = Uri.parse('$_baseUrl/api/coach/nutrition-plan');
    final resp = await http.get(uri, headers: _headers);
    if (resp.statusCode != 200) {
      return ExistingPlanData(profile: null, latestPlan: null, hasPlan: false);
    }
    final body = jsonDecode(resp.body) as Map<String, dynamic>;
    return ExistingPlanData(
      profile: body['profile'] as Map<String, dynamic>?,
      latestPlan: body['latestPlan'] as Map<String, dynamic>?,
      hasPlan: body['hasPlan'] == true,
    );
  }

  static Future<CoachPlanStatusResponse> fetchCoachPlanStatus() async {
    final uri = Uri.parse('$_baseUrl/api/coach/nutrition-plan-status');
    final resp = await http.get(uri, headers: _headers);
    if (resp.statusCode != 200) {
      throw Exception('Failed to load coach plan status: ${resp.body}');
    }
    final body = jsonDecode(resp.body) as Map<String, dynamic>;
    return CoachPlanStatusResponse(
      hasPlan: body['hasPlan'] == true,
      summary: body['summary'] as Map<String, dynamic>?,
    );
  }

  static Future<void> updateCoachGoal(String goalType) async {
    final uri = Uri.parse('$_baseUrl/api/athlete/coach-plan-settings');
    final resp = await http.patch(
      uri,
      headers: _headers,
      body: jsonEncode({'goalType': goalType}),
    );
    if (resp.statusCode != 200) {
      throw Exception('Failed to update coach goal: ${resp.body}');
    }
  }

  /// Generates a plan preview without saving anything.
  static Future<CoachPlanPreview> previewPlan(
    Map<String, dynamic> inputs,
  ) async {
    final uri = Uri.parse('$_baseUrl/api/coach/nutrition-plan');
    final resp = await http.post(
      uri,
      headers: _headers,
      body: jsonEncode({...inputs, 'action': 'preview'}),
    );
    if (resp.statusCode != 200) {
      throw Exception('Preview failed: ${resp.body}');
    }
    final body = jsonDecode(resp.body) as Map<String, dynamic>;
    return CoachPlanPreview.fromJson(body['plan'] as Map<String, dynamic>);
  }

  /// Saves the plan to the database and applies targets to nutrition_days.
  static Future<void> applyPlan(Map<String, dynamic> inputs) async {
    final uri = Uri.parse('$_baseUrl/api/coach/nutrition-plan');
    final resp = await http.post(
      uri,
      headers: _headers,
      body: jsonEncode({...inputs, 'action': 'apply'}),
    );
    if (resp.statusCode != 200) {
      throw Exception('Apply failed: ${resp.body}');
    }
  }
}
