import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:flutter/services.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class AuthService {
  final SupabaseClient _client = Supabase.instance.client;

  Future<void> signInWithGoogle() async {
    final redirectUri = dotenv.env['SUPABASE_REDIRECT_URI'] ?? 'io.supabase.flutter://login-callback';
    print('🔥 signInWithGoogle called');
    print('🔑 redirectUri: $redirectUri');
    await _client.auth.signInWithOAuth(
      OAuthProvider.google,
      redirectTo: redirectUri,
      authScreenLaunchMode: LaunchMode.externalApplication,
    );
  }

  Future<void> signInWithPassword(String email, String password) async {
    await _client.auth.signInWithPassword(email: email, password: password);
  }

  Future<void> signUpWithPassword(String email, String password) async {
    await _client.auth.signUp(email: email, password: password);
  }

  Future<void> upsertAppUser(String email, String? fullName) async {
    await _client
        .from('app_users')
        .upsert(
          {
            'email': email,
            'full_name': fullName,
            'updated_at': DateTime.now().toIso8601String(),
          },
          onConflict: 'email',
        );
  }

  Future<Session?> getCurrentSession() async {
    return _client.auth.currentSession;
  }

  Future<void> signOut() async {
    await _client.auth.signOut();
  }
}

final authServiceProvider = Provider<AuthService>((ref) => AuthService());

