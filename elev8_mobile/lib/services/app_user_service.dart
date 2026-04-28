import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

/// Single source of truth for "which app_users row owns the signed-in
/// Supabase auth user".
///
/// The web app creates `app_users` rows via NextAuth (no Supabase Auth),
/// so `app_users.id` is unrelated to `auth.uid()`. Mobile bridges the two
/// systems by stamping `supabase_auth_uid` on first sign-in (see
/// `main.dart`). Until that stamp lands we fall back to matching by email.
///
/// Six call-sites used to roll their own copy of this lookup with subtly
/// different cache + fallback behavior; this service collapses them into
/// one.
class AppUserService {
  AppUserService(this._client) {
    _authSub = _client.auth.onAuthStateChange.listen((data) {
      // Any auth transition invalidates whichever user we had cached.
      // signedOut clears for obvious reasons; signedIn / userUpdated
      // can change which row we should be pointing at.
      if (data.event == AuthChangeEvent.signedOut ||
          data.event == AuthChangeEvent.signedIn ||
          data.event == AuthChangeEvent.userUpdated) {
        _cachedRow = null;
        _inflight = null;
      }
    });
  }

  final SupabaseClient _client;
  StreamSubscription<AuthState>? _authSub;

  /// Most code only needs the id. Cache the full row so repeated calls
  /// for id / name / role / avatar fold into a single round-trip.
  Map<String, dynamic>? _cachedRow;

  /// Coalesces concurrent first-time fetches into one network request.
  Future<Map<String, dynamic>?>? _inflight;

  /// Columns we always read so derived getters (id, full_name, avatar_url,
  /// role) can be served from cache. Adjust here if a new derived getter
  /// needs more columns.
  static const _selectColumns = 'id, full_name, avatar_url, role';

  void dispose() {
    _authSub?.cancel();
    _authSub = null;
  }

  /// The full app_users row for the signed-in user, or null if there is
  /// no signed-in user / no matching row.
  Future<Map<String, dynamic>?> currentRow() async {
    if (_cachedRow != null) return _cachedRow;
    return _inflight ??= _fetch().whenComplete(() => _inflight = null);
  }

  Future<Map<String, dynamic>?> _fetch() async {
    final authUser = _client.auth.currentUser;
    if (authUser == null) return null;

    try {
      final byUid = await _client
          .from('app_users')
          .select(_selectColumns)
          .eq('supabase_auth_uid', authUser.id)
          .maybeSingle();
      if (byUid != null) {
        _cachedRow = Map<String, dynamic>.from(byUid);
        return _cachedRow;
      }

      final email = authUser.email;
      if (email == null || email.isEmpty) return null;

      final byEmail = await _client
          .from('app_users')
          .select(_selectColumns)
          .eq('email', email)
          .maybeSingle();
      if (byEmail != null) {
        _cachedRow = Map<String, dynamic>.from(byEmail);
      }
      return _cachedRow;
    } catch (e) {
      debugPrint('[AppUserService] fetch failed: $e');
      return null;
    }
  }

  Future<String?> currentId() async => (await currentRow())?['id'] as String?;

  Future<String?> currentRole() async =>
      (await currentRow())?['role'] as String?;

  /// Force the next call to re-query the database. Invoked after writes
  /// that may have changed the row (e.g. role promotion, avatar update).
  void invalidate() {
    _cachedRow = null;
    _inflight = null;
  }
}

final appUserServiceProvider = Provider<AppUserService>((ref) {
  final service = AppUserService(Supabase.instance.client);
  ref.onDispose(service.dispose);
  return service;
});
