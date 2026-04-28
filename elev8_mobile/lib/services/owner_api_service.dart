import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';

import '../config/env.dart';
import '../models/owner_billing.dart';
import '../models/owner_member.dart';
import '../models/owner_payroll_entry.dart';
import '../models/owner_schedule_class.dart';
import '../models/owner_staff.dart';

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

  /// Billing metrics — MRR, ARR, LTV, churn, totals. Backed by Stripe.
  static Future<BillingMetrics> fetchBillingMetrics() async {
    final uri = Uri.parse('$_baseUrl/api/owner/billing/metrics');
    final resp = await http.get(uri, headers: _headers);
    if (resp.statusCode != 200) {
      _throwApiError('Load billing metrics', resp);
    }
    final body = jsonDecode(resp.body) as Map<String, dynamic>;
    return BillingMetrics.fromJson(body);
  }

  /// Top-spending customers (default `limit=10`).
  static Future<List<BillingCustomer>> fetchBillingCustomers({
    int limit = 10,
  }) async {
    final uri = Uri.parse(
      '$_baseUrl/api/owner/billing/customers?limit=$limit',
    );
    final resp = await http.get(uri, headers: _headers);
    if (resp.statusCode != 200) {
      _throwApiError('Load billing customers', resp);
    }
    final body = jsonDecode(resp.body) as Map<String, dynamic>;
    final list = (body['customers'] as List<dynamic>?) ?? const [];
    return list
        .map(
          (c) => BillingCustomer.fromJson(c as Map<String, dynamic>),
        )
        .toList();
  }

  /// Recent payments + refunds (default `limit=50`).
  static Future<List<BillingTransaction>> fetchBillingTransactions({
    int limit = 50,
  }) async {
    final uri = Uri.parse(
      '$_baseUrl/api/owner/billing/transactions?limit=$limit',
    );
    final resp = await http.get(uri, headers: _headers);
    if (resp.statusCode != 200) {
      _throwApiError('Load billing transactions', resp);
    }
    final body = jsonDecode(resp.body) as Map<String, dynamic>;
    final list = (body['transactions'] as List<dynamic>?) ?? const [];
    return list
        .map(
          (t) => BillingTransaction.fromJson(t as Map<String, dynamic>),
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
