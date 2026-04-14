import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'dashboard_screen.dart';
import 'nutrition_screen.dart';
import 'schedule_screen.dart';
import 'athlete_dashboard_screen.dart';
import 'messenger_screen.dart';
import 'auth_screen.dart';
import 'screens/coach_setup_screen.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await dotenv.load(fileName: ".env");

  // Initialize Supabase
  await Supabase.initialize(
    url: dotenv.env['SUPABASE_URL'] ?? '',
    anonKey: dotenv.env['SUPABASE_ANON_KEY'] ?? '',
  );

  // Stamp the Supabase Auth UID onto the existing app_users row (created by
  // NextAuth on the web) so that mobile_app_user_id() can resolve
  // auth.uid() → app_users.id for all RLS policies.
  final auth = Supabase.instance.client.auth;
  auth.onAuthStateChange.listen((data) async {
    final session = data.session;
    final user = session?.user;
    if (user != null) {
      final email = user.email;
      if (email == null) return;
      try {
        await Supabase.instance.client
            .from('app_users')
            .update({
              'supabase_auth_uid': user.id,
              'updated_at': DateTime.now().toIso8601String(),
            })
            .eq('email', email);
      } catch (e) {
        debugPrint('Failed to claim app_user with supabase_auth_uid: $e');
      }
    }
  });

  runApp(const ProviderScope(child: Elev8App()));
}

/// A [ChangeNotifier] that fires whenever Supabase auth state changes,
/// so [GoRouter] can re-evaluate its redirect guard reactively.
class _AuthNotifier extends ChangeNotifier {
  _AuthNotifier() {
    Supabase.instance.client.auth.onAuthStateChange.listen((_) {
      notifyListeners();
    });
  }
}

final _authNotifier = _AuthNotifier();

final routerProvider = Provider<GoRouter>((ref) {
  return GoRouter(
    initialLocation: '/',
    refreshListenable: _authNotifier,
    redirect: (context, state) {
      final isAuthenticated =
          Supabase.instance.client.auth.currentSession != null;
      final isAuthRoute = state.matchedLocation == '/auth';

      if (!isAuthenticated && !isAuthRoute) {
        return '/auth';
      }
      if (isAuthenticated && isAuthRoute) {
        return '/';
      }
      return null;
    },
    routes: [
      GoRoute(
        path: '/',
        builder: (context, state) => const DashboardScreen(),
      ),
      GoRoute(
        path: '/auth',
        builder: (context, state) => const AuthScreen(),
      ),
      GoRoute(
        path: '/schedule',
        builder: (context, state) => const ScheduleScreen(),
      ),
      GoRoute(
        path: '/nutrition',
        builder: (context, state) => const NutritionScreen(),
      ),
      GoRoute(
        path: '/athlete-dashboard',
        builder: (context, state) => const AthleteDashboardScreen(),
      ),
      GoRoute(
        path: '/messenger',
        builder: (context, state) => const MessengerScreen(),
      ),
      GoRoute(
        path: '/coach-setup',
        builder: (context, state) => const CoachSetupScreen(),
      ),
    ],
  );
});

class Elev8App extends ConsumerWidget {
  const Elev8App({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);
    
    return MaterialApp.router(
      title: 'Elev8',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF0F172A), // Tailwind slate-900 
          brightness: Brightness.dark,
        ),
        useMaterial3: true,
        scaffoldBackgroundColor: const Color(0xFF020617), // slate-950
      ),
      routerConfig: router,
    );
  }
}




