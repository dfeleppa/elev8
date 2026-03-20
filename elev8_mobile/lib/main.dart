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

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await dotenv.load(fileName: ".env");

  // Initialize Supabase
  await Supabase.initialize(
    url: dotenv.env['SUPABASE_URL'] ?? '',
    anonKey: dotenv.env['SUPABASE_ANON_KEY'] ?? '',
  );

  // Set up auth state listener to keep app_users in sync (mirroring web app behavior)
  final auth = Supabase.instance.client.auth;
  auth.onAuthStateChange.listen((data) async {
    final session = data.session;
    final user = session?.user;
    if (user != null) {
      final email = user.email;
      final fullName = user.userMetadata?['full_name'] as String? ??
          user.userMetadata?['name'] as String? ??
          user.email?.split('@').first;
      try {
        await Supabase.instance.client
            .from('app_users')
            .upsert(
              {
                'email': email,
                'full_name': fullName,
                'updated_at': DateTime.now().toIso8601String(),
              },
              onConflict: 'email',
            );
      } catch (e) {
        // Optionally log error, but don't break the flow
        debugPrint('Failed to upsert app_user: $e');
      }
    }
  });

  runApp(const ProviderScope(child: Elev8App()));
}

final routerProvider = Provider<GoRouter>((ref) {
  return GoRouter(
    initialLocation: '/',
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




