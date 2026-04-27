import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../data/repositories/nutrition_repository.dart';
import '../../theme/app_colors.dart';
import '../glass_card.dart';
import '../section_header.dart';

/// Quick-glance summary of the active coach plan. Shows goal + weight
/// progress and deep-links into /coach. Reuses [coachPlanStatusProvider]
/// from the nutrition repository — same data the nutrition page's coach
/// card already pulls.
class CoachPlanSummaryCard extends ConsumerWidget {
  const CoachPlanSummaryCard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(coachPlanStatusProvider);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SectionHeader(
          title: 'Coach Plan',
          subtitle: 'Your nutrition coach',
        ),
        async.when(
          loading: () => const GlassCard(
            child: Padding(
              padding: EdgeInsets.symmetric(vertical: 24),
              child: Center(
                child: SizedBox(
                  width: 22,
                  height: 22,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: AppColors.accent,
                  ),
                ),
              ),
            ),
          ),
          error: (_, _) => const _NoPlan(),
          data: (plan) {
            if (plan == null || !plan.hasPlan) return const _NoPlan();
            return _ActivePlan(plan: plan);
          },
        ),
      ],
    );
  }
}

class _ActivePlan extends StatelessWidget {
  final CoachPlanStatus plan;
  const _ActivePlan({required this.plan});

  @override
  Widget build(BuildContext context) {
    final delta = (plan.currentWeight != null && plan.startWeight != null)
        ? (plan.currentWeight! - plan.startWeight!)
        : null;
    final progress = plan.weightProgressPercent;

    return GestureDetector(
      onTap: () => context.go('/coach'),
      child: GradientCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              plan.goalLabel,
              style: const TextStyle(
                color: Colors.white70,
                fontSize: 13,
                fontWeight: FontWeight.w600,
                letterSpacing: 1.2,
              ),
            ),
            const SizedBox(height: 6),
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        plan.currentWeight != null
                            ? '${plan.currentWeight!.toStringAsFixed(1)} lb'
                            : '—',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 28,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        plan.targetWeight != null
                            ? 'Target ${plan.targetWeight!.toStringAsFixed(1)} lb'
                            : 'No target set',
                        style: const TextStyle(color: Colors.white70, fontSize: 13),
                      ),
                    ],
                  ),
                ),
                if (delta != null)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.2),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      '${delta >= 0 ? '+' : ''}${delta.toStringAsFixed(1)} lb',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
              ],
            ),
            if (progress != null) ...[
              const SizedBox(height: 14),
              ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: LinearProgressIndicator(
                  value: progress / 100,
                  minHeight: 6,
                  backgroundColor: Colors.white.withValues(alpha: 0.18),
                  valueColor: const AlwaysStoppedAnimation<Color>(Colors.white),
                ),
              ),
              const SizedBox(height: 6),
              Text(
                '${progress.toStringAsFixed(0)}% to goal',
                style: const TextStyle(color: Colors.white70, fontSize: 12),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _NoPlan extends StatelessWidget {
  const _NoPlan();

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      onTap: () => context.go('/coach'),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: AppColors.accent.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Icon(Icons.restaurant_menu, color: AppColors.accent),
          ),
          const SizedBox(width: 14),
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'No coach plan yet',
                  style: TextStyle(
                    color: AppColors.textOnGlass,
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                SizedBox(height: 2),
                Text(
                  'Tap to set up your nutrition plan.',
                  style: TextStyle(color: AppColors.textMutedOnGlass, fontSize: 13),
                ),
              ],
            ),
          ),
          const Icon(Icons.chevron_right, color: AppColors.textMutedOnGlass),
        ],
      ),
    );
  }
}
