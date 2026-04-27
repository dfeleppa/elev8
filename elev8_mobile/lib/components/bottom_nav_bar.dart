import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

/// Provider for the signed-in user's profile (name + avatar).
///
/// Used by the bottom-nav avatar tab and the dashboard greeting header.
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

/// Bottom navigation bar — 5 tabs.
///
///   0. Home      → /athlete-dashboard
///   1. Schedule  → /schedule
///   2. You       → /account   (renders avatar image when available)
///   3. Nutrition → /nutrition
///   4. Coach     → /coach
class Elev8BottomNavBar extends ConsumerWidget {
  final int selectedIndex;

  const Elev8BottomNavBar({super.key, required this.selectedIndex});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profileAsync = ref.watch(userProfileProvider);
    final avatarUrl = profileAsync.value?['avatar_url'] as String?;
    final fullName = profileAsync.value?['full_name'] as String?;

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
            context.go('/account');
            break;
          case 3:
            context.go('/nutrition');
            break;
          case 4:
            context.go('/coach');
            break;
        }
      },
      destinations: [
        const NavigationDestination(
          icon: Icon(Icons.home_outlined, color: Colors.white54),
          selectedIcon: Icon(Icons.home, color: Colors.white),
          label: 'Home',
        ),
        const NavigationDestination(
          icon: Icon(Icons.calendar_month_outlined, color: Colors.white54),
          selectedIcon: Icon(Icons.calendar_month, color: Colors.white),
          label: 'Schedule',
        ),
        NavigationDestination(
          icon: _AvatarIcon(
            avatarUrl: avatarUrl,
            fullName: fullName,
            selected: false,
          ),
          selectedIcon: _AvatarIcon(
            avatarUrl: avatarUrl,
            fullName: fullName,
            selected: true,
          ),
          label: 'You',
        ),
        const NavigationDestination(
          icon: Icon(Icons.restaurant_outlined, color: Colors.white54),
          selectedIcon: Icon(Icons.restaurant, color: Colors.white),
          label: 'Nutrition',
        ),
        const NavigationDestination(
          icon: Icon(Icons.monitor_heart_outlined, color: Colors.white54),
          selectedIcon: Icon(Icons.monitor_heart, color: Colors.white),
          label: 'Coach',
        ),
      ],
    );
  }
}

/// Circular avatar tab icon. Shows the user's avatar image when one is on
/// their app_users row; falls back to a colored circle with their initial,
/// or a generic person icon if no name is known.
class _AvatarIcon extends StatelessWidget {
  final String? avatarUrl;
  final String? fullName;
  final bool selected;

  const _AvatarIcon({
    required this.avatarUrl,
    required this.fullName,
    required this.selected,
  });

  @override
  Widget build(BuildContext context) {
    final borderColor = selected ? Colors.white : Colors.white54;
    final size = 26.0;

    Widget content;
    if (avatarUrl != null && avatarUrl!.isNotEmpty) {
      content = CircleAvatar(
        radius: size / 2,
        backgroundImage: NetworkImage(avatarUrl!),
        backgroundColor: const Color(0xFF1E293B),
      );
    } else {
      final initial = (fullName ?? '').trim().isNotEmpty
          ? fullName!.trim()[0].toUpperCase()
          : null;
      content = CircleAvatar(
        radius: size / 2,
        backgroundColor: const Color(0xFF1E293B),
        child: initial != null
            ? Text(
                initial,
                style: TextStyle(
                  color: borderColor,
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                ),
              )
            : Icon(Icons.person, size: 16, color: borderColor),
      );
    }

    return Container(
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(
          color: borderColor,
          width: selected ? 2 : 1,
        ),
      ),
      child: ClipOval(child: content),
    );
  }
}
