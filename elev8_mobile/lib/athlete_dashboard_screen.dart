import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'components/bottom_nav_bar.dart';
import 'components/dashboard/coach_plan_summary_card.dart';
import 'components/dashboard/consistency_card.dart';
import 'components/dashboard/health_stats_card.dart';
import 'components/dashboard/today_workout_card.dart';
import 'components/elev8_background.dart';
import 'components/sidebar_shell.dart';
import 'data/repositories/athlete_repository.dart';
import 'data/repositories/nutrition_repository.dart';
import 'theme/app_colors.dart';
import 'theme/app_text.dart';
import 'workout_repository.dart';

class AthleteDashboardScreen extends ConsumerWidget {
  const AthleteDashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profileAsync = ref.watch(userProfileProvider);

    return SidebarShell(
      child: Scaffold(
        backgroundColor: Colors.transparent,
        body: Elev8Background(
          child: SafeArea(
            child: RefreshIndicator(
              color: AppColors.accent,
              onRefresh: () async {
                ref.invalidate(consistencySummaryProvider);
                ref.invalidate(healthStatsProvider);
                ref.invalidate(todaysProgrammingProvider);
                ref.invalidate(coachPlanStatusProvider);
                // Wait for everything to settle so the spinner doesn't snap.
                await Future.wait([
                  ref.read(consistencySummaryProvider.future),
                  ref.read(healthStatsProvider.future),
                  ref.read(todaysProgrammingProvider.future),
                  ref.read(coachPlanStatusProvider.future),
                ]);
              },
              child: ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
                children: [
                  _Header(profileAsync: profileAsync),
                  const SizedBox(height: 20),
                  const TodayWorkoutCard(),
                  const SizedBox(height: 20),
                  const CoachPlanSummaryCard(),
                  const SizedBox(height: 20),
                  const ConsistencyCard(),
                  const SizedBox(height: 20),
                  const HealthStatsCard(),
                  const SizedBox(height: 24),
                ],
              ),
            ),
          ),
        ),
        bottomNavigationBar: const Elev8BottomNavBar(selectedIndex: 0),
      ),
    );
  }
}

/// Greeting + avatar header.
class _Header extends StatelessWidget {
  final AsyncValue<Map<String, dynamic>?> profileAsync;
  const _Header({required this.profileAsync});

  String _greeting() {
    final hour = DateTime.now().hour;
    if (hour < 5) return 'Up late';
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    if (hour < 21) return 'Good evening';
    return 'Good night';
  }

  @override
  Widget build(BuildContext context) {
    return profileAsync.when(
      loading: () => _layout(name: '...', avatar: const _AvatarPlaceholder()),
      error: (_, _) => _layout(name: 'Athlete', avatar: const _AvatarPlaceholder()),
      data: (data) {
        final name = (data?['full_name'] as String?)?.trim();
        final avatarUrl = (data?['avatar_url'] as String?)?.trim();
        return _layout(
          name: name?.isNotEmpty == true ? name! : 'Athlete',
          avatar: avatarUrl?.isNotEmpty == true
              ? CircleAvatar(
                  radius: 22,
                  backgroundImage: NetworkImage(avatarUrl!),
                )
              : _AvatarFallback(initial: (name?.isNotEmpty == true ? name![0] : 'A').toUpperCase()),
        );
      },
    );
  }

  Widget _layout({required String name, required Widget avatar}) {
    return Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                _greeting(),
                style: AppText.label,
              ),
              const SizedBox(height: 2),
              Text(name, style: AppText.screenTitle),
            ],
          ),
        ),
        avatar,
      ],
    );
  }
}

class _AvatarPlaceholder extends StatelessWidget {
  const _AvatarPlaceholder();
  @override
  Widget build(BuildContext context) {
    return CircleAvatar(
      radius: 22,
      backgroundColor: AppColors.accent.withValues(alpha: 0.15),
    );
  }
}

class _AvatarFallback extends StatelessWidget {
  final String initial;
  const _AvatarFallback({required this.initial});
  @override
  Widget build(BuildContext context) {
    return CircleAvatar(
      radius: 22,
      backgroundColor: AppColors.accent,
      child: Text(
        initial,
        style: const TextStyle(
          color: Colors.white,
          fontSize: 16,
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }
}
