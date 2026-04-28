import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:elev8_mobile/config/env.dart';

void main() {
  group('Env', () {
    setUp(() {
      dotenv.testLoad(fileInput: '');
    });

    test('throws StateError when SUPABASE_URL is missing', () {
      expect(() => Env.supabaseUrl, throwsA(isA<StateError>()));
    });

    test('throws StateError when SUPABASE_ANON_KEY is empty', () {
      dotenv.testLoad(fileInput: 'SUPABASE_ANON_KEY=');
      expect(() => Env.supabaseAnonKey, throwsA(isA<StateError>()));
    });

    test('returns value when WEB_APP_URL is set', () {
      dotenv.testLoad(fileInput: 'WEB_APP_URL=https://example.test');
      expect(Env.webAppUrl, 'https://example.test');
    });

    test('redirect uri falls back to default when unset', () {
      expect(Env.supabaseRedirectUri, 'io.supabase.flutter://login-callback');
    });

    test('redirect uri honors override', () {
      dotenv.testLoad(fileInput: 'SUPABASE_REDIRECT_URI=app.elev8://auth');
      expect(Env.supabaseRedirectUri, 'app.elev8://auth');
    });
  });
}
