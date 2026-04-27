import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

/// Provider for the signed-in user's profile (name + avatar).
///
/// Lives here for now because the bottom nav was the only consumer; once
/// Phase C builds the dashboard header it will move to a shared location.
final userProfileProvider = FutureProvider<Map<String, dynamic>?>((ref) async {
  final user = Supabase.instance.client.auth.currentUser;
  if (user == null) return null;

  try {
    final byAuthUid = await Supabase.instance.client
        .from('app_users')
        .select('full_name, avatar_url')
        .eq('supabase_auth_uid', user.id)
        .maybeSingle();

    if (byAuthUid != null) {
      return byAuthUid;
    }

    final email = user.email;
    if (email == null || email.isEmpty) return null;

    final byEmail = await Supabase.instance.client
        .from('app_users')
        .select('full_name, avatar_url')
        .eq('email', email)
        .maybeSingle();
    return byEmail;
  } catch (_) {
    return null;
  }
});

/// Bottom navigation bar — 4 tabs (Home, Schedule, Nutrition, Coach).
///
/// `Home` opens the athlete dashboard. The standalone `You` tab from the
/// previous 5-tab layout was collapsed into Home; the avatar/profile entry
/// point now lives in the dashboard header.
class Elev8BottomNavBar extends ConsumerWidget {
  final int selectedIndex;

  const Elev8BottomNavBar({super.key, required this.selectedIndex});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return NavigationBar(
      backgroundColor: const Color(0xFF0F172A),
      indicatorColor: Colors.white12,
      selectedIndex: selectedIndex,
      onDestinationSelected: (index) {
        switch (index) {
          case 0:
            context.go('/athlete-dashboard');
            break;
          case 1:
            context.go('/schedule');
            break;
          case 2:
            context.go('/nutrition');
            break;
          case 3:
            context.go('/coach');
            break;
        }
      },
      destinations: const [
        NavigationDestination(
          icon: Icon(Icons.home_outlined, color: Colors.white54),
          selectedIcon: Icon(Icons.home, color: Colors.white),
          label: 'Home',
        ),
        NavigationDestination(
          icon: Icon(Icons.calendar_month_outlined, color: Colors.white54),
          selectedIcon: Icon(Icons.calendar_month, color: Colors.white),
          label: 'Schedule',
        ),
        NavigationDestination(
          icon: Icon(Icons.restaurant_outlined, color: Colors.white54),
          selectedIcon: Icon(Icons.restaurant, color: Colors.white),
          label: 'Nutrition',
        ),
        NavigationDestination(
          icon: Icon(Icons.monitor_heart_outlined, color: Colors.white54),
          selectedIcon: Icon(Icons.monitor_heart, color: Colors.white),
          label: 'Coach',
        ),
      ],
    );
  }
}
