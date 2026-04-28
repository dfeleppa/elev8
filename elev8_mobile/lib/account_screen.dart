import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'components/accent_button.dart';
import 'components/bottom_nav_bar.dart';
import 'components/elev8_background.dart';
import 'components/glass_card.dart';
import 'components/sidebar_shell.dart';
import 'theme/app_colors.dart';
import 'theme/app_text.dart';

/// Account / profile landing screen behind the center "You" tab.
///
/// Shows the signed-in user's avatar, name, and email, plus a sign-out
/// button. Future settings (notifications, units, integrations) can land
/// in additional GlassCards on this screen.
class AccountScreen extends ConsumerWidget {
  const AccountScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profileAsync = ref.watch(userProfileProvider);
    final email = Supabase.instance.client.auth.currentUser?.email;

    return SidebarShell(
      child: Scaffold(
        backgroundColor: Colors.transparent,
        body: Elev8Background(
          child: SafeArea(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
              children: [
                Text('Account', style: AppText.screenTitle),
                const SizedBox(height: 20),
                profileAsync.when(
                  loading: () => const _Loading(),
                  error: (_, _) => _ProfileCard(name: 'Athlete', email: email, avatarUrl: null),
                  data: (data) {
                    final name = (data?['full_name'] as String?)?.trim();
                    final avatarUrl = (data?['avatar_url'] as String?)?.trim();
                    return _ProfileCard(
                      name: name?.isNotEmpty == true ? name! : 'Athlete',
                      email: email,
                      avatarUrl: avatarUrl?.isNotEmpty == true ? avatarUrl : null,
                    );
                  },
                ),
                const SizedBox(height: 16),
                GlassCard(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  child: Column(
                    children: [
                      _MenuRow(
                        icon: Icons.local_dining_outlined,
                        label: 'Nutrition',
                        onTap: () => context.go('/nutrition'),
                      ),
                      const _Divider(),
                      _MenuRow(
                        icon: Icons.monitor_heart_outlined,
                        label: 'Coach plan',
                        onTap: () => context.go('/coach'),
                      ),
                      const _Divider(),
                      _MenuRow(
                        icon: Icons.calendar_month_outlined,
                        label: 'Schedule',
                        onTap: () => context.go('/schedule'),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 24),
                GhostButton(
                  label: 'Sign out',
                  fullWidth: true,
                  onPressed: () => _signOut(context),
                ),
              ],
            ),
          ),
        ),
        bottomNavigationBar: const Elev8BottomNavBar(selectedIndex: 2),
      ),
    );
  }

  Future<void> _signOut(BuildContext context) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.glassFill,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text(
          'Sign out?',
          style: TextStyle(color: AppColors.textOnGlass, fontWeight: FontWeight.bold),
        ),
        content: const Text(
          'You will need to sign back in to view your data.',
          style: TextStyle(color: AppColors.textOnGlass, fontSize: 14),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.accent,
              foregroundColor: Colors.white,
            ),
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Sign out'),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      await Supabase.instance.client.auth.signOut();
      // Router redirect rule on `/` and other authed routes will push the
      // user to /auth automatically.
    }
  }
}

class _ProfileCard extends StatelessWidget {
  final String name;
  final String? email;
  final String? avatarUrl;
  const _ProfileCard({required this.name, required this.email, required this.avatarUrl});

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      child: Row(
        children: [
          _LargeAvatar(name: name, avatarUrl: avatarUrl),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(name, style: AppText.cardTitle),
                if (email != null && email!.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(email!, style: AppText.label),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _LargeAvatar extends StatelessWidget {
  final String name;
  final String? avatarUrl;
  const _LargeAvatar({required this.name, required this.avatarUrl});

  @override
  Widget build(BuildContext context) {
    if (avatarUrl != null && avatarUrl!.isNotEmpty) {
      return CircleAvatar(
        radius: 32,
        backgroundImage: NetworkImage(avatarUrl!),
        backgroundColor: AppColors.accent.withValues(alpha: 0.15),
      );
    }
    final initial = name.trim().isNotEmpty ? name.trim()[0].toUpperCase() : 'A';
    return CircleAvatar(
      radius: 32,
      backgroundColor: AppColors.accent,
      child: Text(
        initial,
        style: const TextStyle(
          color: Colors.white,
          fontSize: 22,
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }
}

class _MenuRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  const _MenuRow({required this.icon, required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
        child: Row(
          children: [
            Icon(icon, color: AppColors.accent, size: 22),
            const SizedBox(width: 14),
            Expanded(child: Text(label, style: AppText.value)),
            const Icon(Icons.chevron_right, color: AppColors.textMutedOnGlass),
          ],
        ),
      ),
    );
  }
}

class _Divider extends StatelessWidget {
  const _Divider();
  @override
  Widget build(BuildContext context) {
    return Divider(height: 1, color: AppColors.glassBorder);
  }
}

class _Loading extends StatelessWidget {
  const _Loading();
  @override
  Widget build(BuildContext context) {
    return const GlassCard(
      child: Padding(
        padding: EdgeInsets.symmetric(vertical: 24),
        child: Center(
          child: SizedBox(
            width: 22,
            height: 22,
            child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.accent),
          ),
        ),
      ),
    );
  }
}
