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
class AccountScreen extends ConsumerWidget {
  const AccountScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profileAsync = ref.watch(userProfileProvider);
    final authUser = Supabase.instance.client.auth.currentUser;

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
                  error: (e, _) => _ErrorCard(message: e.toString()),
                  data: (data) => _AccountBody(row: data, authUser: authUser),
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
    }
  }
}

class _AccountBody extends StatelessWidget {
  final Map<String, dynamic>? row;
  final User? authUser;
  const _AccountBody({required this.row, required this.authUser});

  @override
  Widget build(BuildContext context) {
    final fullName = (row?['full_name'] as String?)?.trim();
    final emailFromRow = (row?['email'] as String?)?.trim();
    final emailFromAuth = authUser?.email;
    final email = emailFromRow?.isNotEmpty == true ? emailFromRow : emailFromAuth;
    final displayName = fullName?.isNotEmpty == true
        ? fullName!
        : (authUser?.userMetadata?['full_name'] as String?) ??
            (authUser?.userMetadata?['name'] as String?) ??
            'Athlete';

    return Column(
      children: [
        _ProfileCard(name: displayName, email: email),
        const SizedBox(height: 16),
        _ProfileFieldsCard(row: row),
        const SizedBox(height: 16),
        _AuthDebugCard(row: row, authUser: authUser),
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
      ],
    );
  }
}

class _ProfileCard extends StatelessWidget {
  final String name;
  final String? email;
  const _ProfileCard({required this.name, required this.email});

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      child: Row(
        children: [
          _LargeAvatar(name: name),
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

class _ProfileFieldsCard extends StatelessWidget {
  final Map<String, dynamic>? row;
  const _ProfileFieldsCard({required this.row});

  @override
  Widget build(BuildContext context) {
    final role = (row?['role'] as String?)?.trim();
    final sex = (row?['sex'] as String?)?.trim();
    final birthDate = row?['birth_date'] as String?;
    final age = _computeAge(birthDate);
    final heightCm = (row?['height_cm'] as num?)?.toDouble();
    final weightKg = (row?['current_weight_kg'] as num?)?.toDouble();
    final bodyFat = (row?['body_fat_percent'] as num?)?.toDouble();
    final createdAt = row?['created_at'] as String?;

    return GlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('PROFILE', style: AppText.eyebrow),
          const SizedBox(height: 12),
          _Field(label: 'Role', value: role ?? '—'),
          _Field(label: 'Sex', value: sex ?? '—'),
          _Field(
            label: 'Birth date',
            value: birthDate ?? '—',
            trailing: age != null ? '($age yrs)' : null,
          ),
          _Field(label: 'Height', value: _formatHeight(heightCm)),
          _Field(label: 'Weight', value: _formatWeight(weightKg)),
          _Field(
            label: 'Body fat',
            value: bodyFat != null ? '${bodyFat.toStringAsFixed(1)}%' : '—',
          ),
          _Field(label: 'Member since', value: _formatDate(createdAt)),
        ],
      ),
    );
  }

  static int? _computeAge(String? isoDate) {
    if (isoDate == null || isoDate.isEmpty) return null;
    final dob = DateTime.tryParse(isoDate);
    if (dob == null) return null;
    final now = DateTime.now();
    var years = now.year - dob.year;
    if (now.month < dob.month || (now.month == dob.month && now.day < dob.day)) {
      years--;
    }
    return years >= 0 ? years : null;
  }

  static String _formatHeight(double? cm) {
    if (cm == null) return '—';
    final totalInches = cm / 2.54;
    final feet = totalInches ~/ 12;
    final inches = (totalInches - feet * 12).round();
    return '${cm.toStringAsFixed(0)} cm  ·  $feet′ $inches″';
  }

  static String _formatWeight(double? kg) {
    if (kg == null) return '—';
    final lbs = kg * 2.2046226218;
    return '${kg.toStringAsFixed(1)} kg  ·  ${lbs.toStringAsFixed(1)} lb';
  }

  static String _formatDate(String? iso) {
    if (iso == null || iso.isEmpty) return '—';
    final dt = DateTime.tryParse(iso);
    if (dt == null) return '—';
    return '${dt.year}-${dt.month.toString().padLeft(2, '0')}-${dt.day.toString().padLeft(2, '0')}';
  }
}

class _AuthDebugCard extends StatelessWidget {
  final Map<String, dynamic>? row;
  final User? authUser;
  const _AuthDebugCard({required this.row, required this.authUser});

  @override
  Widget build(BuildContext context) {
    final hasRow = row != null;
    final appUserId = row?['id'] as String?;
    final stampedUid = row?['supabase_auth_uid'] as String?;
    final authUid = authUser?.id;
    final jwtEmail = authUser?.email;
    final rowEmail = (row?['email'] as String?)?.trim();
    final provider = (authUser?.appMetadata['provider'] as String?) ??
        (authUser?.appMetadata['providers'] is List
            ? (authUser!.appMetadata['providers'] as List).join(', ')
            : null);
    final stampMatch = stampedUid != null && stampedUid == authUid;
    final emailMatch = rowEmail != null &&
        jwtEmail != null &&
        rowEmail.toLowerCase() == jwtEmail.toLowerCase();

    return GlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('AUTH DEBUG', style: AppText.eyebrow),
          const SizedBox(height: 12),
          _Field(
            label: 'app_users row',
            value: hasRow ? 'found' : 'NOT FOUND',
            warn: !hasRow,
          ),
          _Field(
            label: 'supabase_auth_uid',
            value: stampedUid ?? '— (not stamped)',
            warn: stampedUid == null,
          ),
          _Field(
            label: 'uid match',
            value: stampMatch ? 'yes' : 'no',
            warn: !stampMatch,
          ),
          _Field(
            label: 'email match',
            value: emailMatch ? 'yes' : 'no',
            warn: !emailMatch,
          ),
          _Field(label: 'provider', value: provider ?? '—'),
          _Field(label: 'auth.uid()', value: authUid ?? '—'),
          _Field(label: 'app_users.id', value: appUserId ?? '—'),
          _Field(label: 'jwt email', value: jwtEmail ?? '—'),
          _Field(label: 'row email', value: rowEmail ?? '—'),
        ],
      ),
    );
  }
}

class _Field extends StatelessWidget {
  final String label;
  final String value;
  final String? trailing;
  final bool warn;
  const _Field({
    required this.label,
    required this.value,
    this.trailing,
    this.warn = false,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 130,
            child: Text(label, style: AppText.label),
          ),
          Expanded(
            child: Text(
              trailing == null ? value : '$value  $trailing',
              style: AppText.value.copyWith(
                color: warn ? Colors.orangeAccent : AppColors.textOnGlass,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _LargeAvatar extends StatelessWidget {
  final String name;
  const _LargeAvatar({required this.name});

  @override
  Widget build(BuildContext context) {
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

class _ErrorCard extends StatelessWidget {
  final String message;
  const _ErrorCard({required this.message});
  @override
  Widget build(BuildContext context) {
    return GlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('LOAD ERROR', style: AppText.eyebrow.copyWith(color: Colors.orangeAccent)),
          const SizedBox(height: 8),
          Text(message, style: AppText.value),
        ],
      ),
    );
  }
}
