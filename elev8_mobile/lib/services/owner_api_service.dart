import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';

import '../config/env.dart';
import '../models/member_track_assignment.dart';
import '../models/owner_member.dart';
import '../models/owner_payroll_entry.dart';
import '../models/owner_schedule_class.dart';
import '../models/owner_staff.dart';
import '../models/programming_track.dart';

/// Owner-only API client. Same bearer-auth pattern as
/// [AthleteApiService] / [CoachApiService] — hits the web app's
/// /api/owner/* endpoints, which gate by role >= owner.
class OwnerApiService {
  static String get _baseUrl => Env.webAppUrl;

  static String? get _accessToken =>
      Supabase.instance.client.auth.currentSession?.accessToken;

  static Map<String, String> get _headers => {
    'Content-Type': 'application/json',
    if (_accessToken != null) 'Authorization': 'Bearer $_accessToken',
  };

  static Never _throwApiError(String operation, http.Response resp) {
    debugPrint(
      '[OwnerApi] $operation failed (${resp.statusCode}): ${resp.body}',
    );
    throw Exception('$operation failed (HTTP ${resp.statusCode}).');
  }

  /// Members directory — every row in the gym's `members` table.
  static Future<List<OwnerMember>> fetchMembers() async {
    final uri = Uri.parse('$_baseUrl/api/owner/members');
    final resp = await http.get(uri, headers: _headers);
    if (resp.statusCode != 200) {
      _throwApiError('Load members', resp);
    }
    final body = jsonDecode(resp.body) as Map<String, dynamic>;
    final list = (body['members'] as List<dynamic>?) ?? const [];
    return list
        .map((m) => OwnerMember.fromJson(m as Map<String, dynamic>))
        .toList();
  }

  /// Staff roster — every app_user with role coach/admin/owner. Server
  /// returns `{ staff, promotableMembers }`; we only surface staff in
  /// this read-only first cut.
  static Future<List<OwnerStaff>> fetchStaff() async {
    final uri = Uri.parse('$_baseUrl/api/owner/staff');
    final resp = await http.get(uri, headers: _headers);
    if (resp.statusCode != 200) {
      _throwApiError('Load staff', resp);
    }
    final body = jsonDecode(resp.body) as Map<String, dynamic>;
    final list = (body['staff'] as List<dynamic>?) ?? const [];
    return list
        .map((s) => OwnerStaff.fromJson(s as Map<String, dynamic>))
        .toList();
  }

  /// Payroll — every entry in payroll_entries, sorted newest week first.
  static Future<List<OwnerPayrollEntry>> fetchPayrollEntries() async {
    final uri = Uri.parse('$_baseUrl/api/owner/payroll');
    final resp = await http.get(uri, headers: _headers);
    if (resp.statusCode != 200) {
      _throwApiError('Load payroll', resp);
    }
    final body = jsonDecode(resp.body) as Map<String, dynamic>;
    final list = (body['entries'] as List<dynamic>?) ?? const [];
    return list
        .map(
          (e) => OwnerPayrollEntry.fromJson(e as Map<String, dynamic>),
        )
        .toList();
  }

  /// Every programming track, including inactive ones. AthleteApiService
  /// has its own fetchTracks() that filters to active — keep both.
  static Future<List<ProgrammingTrack>> fetchAllTracks() async {
    final uri = Uri.parse('$_baseUrl/api/programming/tracks');
    final resp = await http.get(uri, headers: _headers);
    if (resp.statusCode != 200) {
      _throwApiError('Load tracks', resp);
    }
    final body = jsonDecode(resp.body) as Map<String, dynamic>;
    final list = (body['tracks'] as List<dynamic>?) ?? const [];
    return list
        .map(
          (t) => ProgrammingTrack.fromJson(t as Map<String, dynamic>),
        )
        .toList();
  }

  /// Member → tracks assignments for the Tracks & Memberships screen.
  static Future<List<MemberTrackAssignment>>
      fetchTrackMemberAssignments() async {
    final uri = Uri.parse('$_baseUrl/api/owner/tracks-memberships/members');
    final resp = await http.get(uri, headers: _headers);
    if (resp.statusCode != 200) {
      _throwApiError('Load track assignments', resp);
    }
    final body = jsonDecode(resp.body) as Map<String, dynamic>;
    final list = (body['members'] as List<dynamic>?) ?? const [];
    return list
        .map(
          (m) => MemberTrackAssignment.fromJson(m as Map<String, dynamic>),
        )
        .toList();
  }

  /// Class Setup — every recurring class on the gym schedule, hydrated
  /// with its track + default coach.
  static Future<List<OwnerScheduleClass>> fetchScheduleClasses() async {
    final uri = Uri.parse('$_baseUrl/api/owner/schedule/classes');
    final resp = await http.get(uri, headers: _headers);
    if (resp.statusCode != 200) {
      _throwApiError('Load classes', resp);
    }
    final body = jsonDecode(resp.body) as Map<String, dynamic>;
    final list = (body['classes'] as List<dynamic>?) ?? const [];
    return list
        .map(
          (c) => OwnerScheduleClass.fromJson(c as Map<String, dynamic>),
        )
        .toList();
  }
}
