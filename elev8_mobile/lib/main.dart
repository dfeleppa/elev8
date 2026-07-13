import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'config/env.dart';
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
import 'screens/owner_members_screen.dart';
import 'screens/owner_payroll_screen.dart';
import 'screens/owner_schedule_screen.dart';
import 'screens/owner_staff_screen.dart';
import 'screens/owner_tracks_memberships_screen.dart';
import 'screens/placeholder_screen.dart';
import 'theme/app_theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await dotenv.load(fileName: ".env");

  // Initialize Supabase. `Env.*` throws if the values are missing so
  // we surface the misconfig immediately instead of booting the app
  // with empty credentials and failing at first request.
  await Supabase.initialize(
    url: Env.supabaseUrl,
    anonKey: Env.supabaseAnonKey,
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
      // Root → workout (today's programming) for backwards compat.
      GoRoute(path: '/', redirect: (_, _) => '/member/workout'),

      GoRoute(
        path: '/auth',
        builder: (context, state) => const AuthScreen(),
      ),

      // ── Athlete (member) routes ────────────────────────────────────────
      GoRoute(
        path: '/member/athlete-dashboard',
        builder: (context, state) => const AthleteDashboardScreen(),
      ),
      GoRoute(
        path: '/member/workout',
        builder: (context, state) => const WorkoutScreen(),
      ),
      GoRoute(
        path: '/member/class-schedule',
        builder: (context, state) => const ScheduleScreen(),
      ),
      GoRoute(
        path: '/member/nutrition',
        builder: (context, state) => const NutritionScreen(),
      ),
      // /member/nutrition-coach → existing CoachScreen (member-facing
      // nutrition coach landing page).
      GoRoute(
        path: '/member/nutrition-coach',
        builder: (context, state) => const CoachScreen(),
      ),
      GoRoute(
        path: '/member/account-dashboard',
        builder: (context, state) => const AccountScreen(),
      ),
      GoRoute(
        path: '/member/store',
        builder: (context, state) => const PlaceholderScreen(
          title: 'Store',
          section: 'Account',
          icon: Icons.shopping_bag_outlined,
        ),
      ),

      // ── Gym view: Overview ─────────────────────────────────────────────
      GoRoute(
        path: '/gym-dashboard',
        builder: (context, state) => const DashboardScreen(),
      ),

      // ── Gym view: Owner / Management ───────────────────────────────────
      GoRoute(
        path: '/owner/staff',
        builder: (context, state) => const OwnerStaffScreen(),
      ),
      GoRoute(
        path: '/owner/schedule',
        builder: (context, state) => const OwnerScheduleScreen(),
      ),
      GoRoute(
        path: '/owner/payroll',
        builder: (context, state) => const OwnerPayrollScreen(),
      ),
      GoRoute(
        path: '/owner/tracks-memberships',
        builder: (context, state) => const OwnerTracksMembershipsScreen(),
      ),
      GoRoute(
        path: '/owner/members',
        builder: (context, state) => const OwnerMembersScreen(),
      ),
      GoRoute(
        path: '/owner/settings',
        builder: (context, state) => const PlaceholderScreen(
          title: 'Gym Settings',
          section: 'Management',
          icon: Icons.settings_outlined,
        ),
      ),

      // ── Gym view: Admin / Operations ───────────────────────────────────
      GoRoute(
        path: '/management',
        builder: (context, state) => const PlaceholderScreen(
          title: 'Management',
          section: 'Operations',
          icon: Icons.work_outline,
        ),
      ),
      GoRoute(
        path: '/admin/content',
        builder: (context, state) => const PlaceholderScreen(
          title: 'Content',
          section: 'Operations',
          icon: Icons.article_outlined,
        ),
      ),
      GoRoute(
        path: '/admin/analytics',
        builder: (context, state) => const PlaceholderScreen(
          title: 'Business Analytics',
          section: 'Operations',
          icon: Icons.insights_outlined,
        ),
      ),
      GoRoute(
        path: '/admin/programming',
        builder: (context, state) => const PlaceholderScreen(
          title: 'Programming',
          section: 'Operations',
          icon: Icons.fitness_center,
        ),
      ),

      // ── Gym view: Coach / Coaching ─────────────────────────────────────
      GoRoute(
        path: '/coach/nutrition-coach',
        builder: (context, state) => const PlaceholderScreen(
          title: 'Nutrition Coach',
          section: 'Coaching',
          icon: Icons.monitor_heart,
        ),
      ),
      GoRoute(
        path: '/coach/schedule',
        builder: (context, state) => const PlaceholderScreen(
          title: 'Coach Schedule',
          section: 'Coaching',
          icon: Icons.calendar_month,
        ),
      ),
      GoRoute(
        path: '/coach/reports-members',
        builder: (context, state) => const PlaceholderScreen(
          title: 'Reports - Members',
          section: 'Coaching',
          icon: Icons.assignment_outlined,
        ),
      ),

      // ── Coach plan wizard (member-facing) ──────────────────────────────
      GoRoute(
        path: '/coach-setup',
        builder: (context, state) => CoachSetupScreen(
          fresh: state.uri.queryParameters['fresh'] == 'true',
        ),
      ),

      // ── Misc / supporting ──────────────────────────────────────────────
      GoRoute(
        path: '/messenger',
        builder: (context, state) => const MessengerScreen(),
      ),

      // ── Legacy route aliases (preserved for deep links / push notifs) ──
      GoRoute(path: '/workout', redirect: (_, _) => '/member/workout'),
      GoRoute(path: '/schedule', redirect: (_, _) => '/member/class-schedule'),
      GoRoute(path: '/nutrition', redirect: (_, _) => '/member/nutrition'),
      GoRoute(
        path: '/athlete-dashboard',
        redirect: (_, _) => '/member/athlete-dashboard',
      ),
      GoRoute(
        path: '/account',
        redirect: (_, _) => '/member/account-dashboard',
      ),
      GoRoute(path: '/coach', redirect: (_, _) => '/member/nutrition-coach'),
      GoRoute(path: '/dashboard', redirect: (_, _) => '/gym-dashboard'),
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
