import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../services/app_user_service.dart';
import '../theme/app_colors.dart';
import '../theme/app_text.dart';

/// Provider for the signed-in user's profile (name + avatar). Backed by
/// the shared [AppUserService] so the lookup is shared with role / id /
/// repo callers.
final userProfileProvider = FutureProvider<Map<String, dynamic>?>((ref) async {
  return ref.read(appUserServiceProvider).currentRow();
});

/// Bottom navigation bar — 5 tabs.
///
///   0. Workout   → /member/workout         (today's programming + track selector)
///   1. Schedule  → /member/class-schedule
///   2. You       → opens a sheet with [Athlete Dashboard, Account]
///   3. Nutrition → /member/nutrition
///   4. Messages  → /messenger              (coming soon)
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
            context.go('/member/workout');
            break;
          case 1:
            context.go('/member/class-schedule');
            break;
          case 2:
            _showYouSheet(context);
            break;
          case 3:
            context.go('/member/nutrition');
            break;
          case 4:
            context.go('/messenger');
            break;
        }
      },
      destinations: [
        const NavigationDestination(
          icon: Icon(Icons.fitness_center_outlined, color: Colors.white54),
          selectedIcon: Icon(Icons.fitness_center, color: Colors.white),
          label: 'Workout',
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
          icon: Icon(Icons.forum_outlined, color: Colors.white54),
          selectedIcon: Icon(Icons.forum, color: Colors.white),
          label: 'Messages',
        ),
      ],
    );
  }
}

void _showYouSheet(BuildContext context) {
  showModalBottomSheet<void>(
    context: context,
    backgroundColor: Colors.transparent,
    builder: (ctx) {
      return Container(
        decoration: const BoxDecoration(
          color: AppColors.glassFill,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 12),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 40,
                  height: 4,
                  margin: const EdgeInsets.only(bottom: 12),
                  decoration: BoxDecoration(
                    color: AppColors.glassBorder,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
                _SheetTile(
                  icon: Icons.dashboard_customize_outlined,
                  label: 'Athlete Dashboard',
                  description: "Today's stats, streak, coach plan",
                  onTap: () {
                    Navigator.of(ctx).pop();
                    ctx.go('/member/athlete-dashboard');
                  },
                ),
                _SheetTile(
                  icon: Icons.person_outline,
                  label: 'Account Dashboard',
                  description: 'Profile, settings, sign out',
                  onTap: () {
                    Navigator.of(ctx).pop();
                    ctx.go('/member/account-dashboard');
                  },
                ),
              ],
            ),
          ),
        ),
      );
    },
  );
}

class _SheetTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final String description;
  final VoidCallback onTap;

  const _SheetTile({
    required this.icon,
    required this.label,
    required this.description,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppColors.accent.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, color: AppColors.accent),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label, style: AppText.value),
                  const SizedBox(height: 2),
                  Text(description, style: AppText.caption),
                ],
              ),
            ),
            const Icon(Icons.chevron_right, color: AppColors.textMutedOnGlass),
          ],
        ),
      ),
    );
  }
}

/// Circular avatar tab icon. Uses the user's avatar image when available,
/// otherwise a colored circle with their initial, or a person icon.
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
    const size = 26.0;

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
