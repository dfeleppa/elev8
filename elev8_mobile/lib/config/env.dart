import 'package:flutter_dotenv/flutter_dotenv.dart';

/// Typed access to required environment variables.
///
/// Throws [StateError] at first access if a required key is missing or empty
/// — better than silently defaulting to a hardcoded production URL or an
/// empty Supabase anon key, which used to mask misconfigured `.env` files.
class Env {
  Env._();

  static String _require(String key) {
    final value = dotenv.maybeGet(key);
    if (value == null || value.isEmpty) {
      throw StateError(
        'Missing required env var "$key". '
        'Check that elev8_mobile/.env is bundled and populated '
        '(see ENV_VARIABLES.md).',
      );
    }
    return value;
  }

  static String get supabaseUrl => _require('SUPABASE_URL');
  static String get supabaseAnonKey => _require('SUPABASE_ANON_KEY');
  static String get webAppUrl => _require('WEB_APP_URL');

  /// Optional: OAuth deep-link redirect. Falls back to the standard
  /// supabase_flutter scheme since both the iOS Info.plist and the
  /// Android intent-filter declare it.
  static String get supabaseRedirectUri =>
      dotenv.maybeGet('SUPABASE_REDIRECT_URI') ??
      'io.supabase.flutter://login-callback';
}
