import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'dashboard_screen.dart';
import 'nutrition_screen.dart';
import 'schedule_screen.dart';
import 'athlete_dashboard_screen.dart';
import 'account_screen.dart';
import 'messenger_screen.dart';
import 'auth_screen.dart';
import 'coach_screen.dart';
import 'workout_screen.dart';
import 'screens/coach_setup_screen.dart';
import 'theme/app_theme.dart';

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
  // auth.uid() → app_users.id for all RLS policies. Only run on initial
  // sign-in events — onAuthStateChange also fires on every silent token
  // refresh (~hourly), and we don't need to re-write the same value forever.
  final auth = Supabase.instance.client.auth;
  auth.onAuthStateChange.listen((data) async {
    if (data.event != AuthChangeEvent.signedIn) return;
    final user = data.session?.user;
    if (user == null) return;
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
      // Root redirects to the Workout tab — the new "Home" landing screen.
      GoRoute(
        path: '/',
        redirect: (context, state) => '/workout',
      ),
      GoRoute(
        path: '/workout',
        builder: (context, state) => const WorkoutScreen(),
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
        path: '/account',
        builder: (context, state) => const AccountScreen(),
      ),
      GoRoute(
        path: '/messenger',
        builder: (context, state) => const MessengerScreen(),
      ),
      // /coach is the new top-level coach screen. Shows the active plan
      // (with a "Start new plan" CTA) when one exists, or an empty-state
      // CTA that opens the wizard when one doesn't.
      GoRoute(
        path: '/coach',
        builder: (context, state) => const CoachScreen(),
      ),
      GoRoute(
        path: '/coach-setup',
        builder: (context, state) => CoachSetupScreen(
          fresh: state.uri.queryParameters['fresh'] == 'true',
        ),
      ),
      // Legacy /dashboard route preserved for deep links (e.g. push
      // notifications) that may still reference it.
      GoRoute(
        path: '/dashboard',
        builder: (context, state) => const DashboardScreen(),
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
      theme: AppTheme.dark(),
      routerConfig: router,
    );
  }
}




