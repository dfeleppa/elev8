import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'components/accent_button.dart';
import 'components/bottom_nav_bar.dart';
import 'components/coach/plan_overview_card.dart';
import 'components/elev8_background.dart';
import 'components/glass_card.dart';
import 'components/sidebar_shell.dart';
import 'services/coach_api_service.dart';
import 'theme/app_colors.dart';
import 'theme/app_text.dart';

/// Loads the full plan + member profile from the web API. We need both to
/// render the dashboard view (calories, macros, intensity → from latestPlan;
/// start weight, body fat → from profile + plan_payload).
final existingCoachPlanProvider = FutureProvider<ExistingPlanData?>((ref) async {
  try {
    return await CoachApiService.fetchExistingPlan();
  } catch (e) {
    debugPrint('[CoachScreen] fetchExistingPlan failed: $e');
    return null;
  }
});

/// Coach tab landing screen.
///
/// - When a plan exists: shows the "view current plan" dashboard (Plan
///   Overview, Starting Stats, Current Progress) with a Start New Plan
///   action that opens the wizard.
/// - When no plan: shows an empty state CTA that opens the wizard fresh.
///
/// Mirrors the web's CoachSetupClient.tsx `viewMode === "dashboard"`
/// state, ported to mobile-friendly layout using phase-A components.
class CoachScreen extends ConsumerWidget {
  const CoachScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(existingCoachPlanProvider);

    return SidebarShell(
      child: Scaffold(
        backgroundColor: Colors.transparent,
        body: Elev8Background(
          child: SafeArea(
            child: RefreshIndicator(
              color: AppColors.accent,
              onRefresh: () async {
                ref.invalidate(existingCoachPlanProvider);
                await ref.read(existingCoachPlanProvider.future);
              },
              child: async.when(
                loading: () => const _LoadingPage(),
                error: (_, _) => const _ErrorPage(),
                data: (plan) {
                  if (plan == null || !plan.hasPlan) {
                    return const _EmptyState();
                  }
                  return _Dashboard(data: plan);
                },
              ),
            ),
          ),
        ),
        // Nutrition Coach lives under Nutrition in the sidebar — keep the
        // Nutrition tab highlighted so the user knows where they are.
        bottomNavigationBar: const Elev8BottomNavBar(selectedIndex: 3),
      ),
    );
  }
}

// ── Active plan view ────────────────────────────────────────────────────────

class _Dashboard extends StatelessWidget {
  final ExistingPlanData data;
  const _Dashboard({required this.data});

  double? _asDouble(dynamic v) {
    if (v == null) return null;
    if (v is num) return v.toDouble();
    return double.tryParse(v.toString());
  }

  DateTime? _asDate(dynamic v) {
    if (v == null) return null;
    return DateTime.tryParse(v.toString());
  }

  String _fmtNum(double? v, {int digits = 0, String unit = ''}) {
    if (v == null) return '—';
    final d = digits == 0 ? v.toStringAsFixed(0) : v.toStringAsFixed(digits);
    return unit.isEmpty ? d : '$d $unit';
  }

  @override
  Widget build(BuildContext context) {
    final plan = data.latestPlan ?? const <String, dynamic>{};
    final profile = data.profile ?? const <String, dynamic>{};
    final payload = (plan['plan_payload'] as Map<String, dynamic>?) ??
        const <String, dynamic>{};

    final goal = plan['goal_type'] as String?;
    final intensity = plan['intensity_preset'] as String?;
    final targetKcal = _asDouble(plan['target_calories']);
    final maintenance = _asDouble(plan['maintenance_calories']);
    final protein = _asDouble(plan['protein_grams']);
    final carbs = _asDouble(plan['carbs_grams']);
    final fat = _asDouble(plan['fat_grams']);
    final effectiveDate = _asDate(plan['effective_date']);
    final targetWeight = _asDouble(plan['target_weight_lbs']);

    // Start stats live in plan_payload (captured at plan creation) and
    // current stats live on app_users (the profile blob).
    final startWeight = _asDouble(payload['weightLbs']);
    final startBodyFat = _asDouble(payload['bodyFatPercentage']);

    final currentWeightKg = _asDouble(profile['current_weight_kg']);
    final currentWeight =
        currentWeightKg == null ? null : currentWeightKg * 2.20462;
    final currentBodyFat = _asDouble(profile['body_fat_percent']);

    final delta = (currentWeight != null && startWeight != null)
        ? (currentWeight - startWeight)
        : null;

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
      children: [
        Text('Coach', style: AppText.screenTitle),
        const SizedBox(height: 16),
        PlanOverviewCard(
          goalType: goal,
          targetCalories: targetKcal,
          proteinGrams: protein,
          effectiveDate: effectiveDate,
          intensityPreset: intensity,
        ),
        const SizedBox(height: 16),
        CoachStatsCard(
          title: 'STARTING STATS',
          stats: [
            CoachStat(
              label: 'Start weight',
              value: _fmtNum(startWeight, digits: 1, unit: 'lb'),
            ),
            CoachStat(
              label: 'Body fat',
              value: _fmtNum(startBodyFat, digits: 1, unit: '%'),
            ),
            CoachStat(
              label: 'Target',
              value: _fmtNum(targetWeight, digits: 1, unit: 'lb'),
            ),
          ],
        ),
        const SizedBox(height: 16),
        CoachStatsCard(
          title: 'CURRENT PROGRESS',
          stats: [
            CoachStat(
              label: 'Current weight',
              value: _fmtNum(currentWeight, digits: 1, unit: 'lb'),
            ),
            CoachStat(
              label: 'Body fat',
              value: _fmtNum(currentBodyFat, digits: 1, unit: '%'),
            ),
            CoachStat(
              label: 'Change',
              value: delta == null
                  ? '—'
                  : '${delta >= 0 ? '+' : ''}${delta.toStringAsFixed(1)} lb',
              accentColor: delta == null
                  ? null
                  : (delta < 0 ? AppColors.fatGreen : AppColors.accent),
            ),
            CoachStat(
              label: 'Maintenance',
              value: _fmtNum(maintenance, unit: 'kcal'),
            ),
            CoachStat(label: 'Carbs', value: _fmtNum(carbs, unit: 'g')),
            CoachStat(label: 'Fat', value: _fmtNum(fat, unit: 'g')),
          ],
        ),
        const SizedBox(height: 24),
        AccentButton(
          label: 'Start a new plan',
          icon: Icons.refresh,
          fullWidth: true,
          onPressed: () => _confirmStartNew(context),
        ),
        const SizedBox(height: 12),
        GhostButton(
          label: 'Adjust current plan',
          fullWidth: true,
          onPressed: () => context.go('/coach-setup'),
        ),
      ],
    );
  }

  Future<void> _confirmStartNew(BuildContext context) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => const _ConfirmStartNewPlanDialog(),
    );
    if (ok == true && context.mounted) {
      // ?fresh=true tells the wizard to skip pre-filling from the previous
      // plan. The new plan's later effective_date makes it the active one
      // automatically (see src/lib/coach-plan.ts), so no explicit "complete
      // old plan" call is needed.
      context.go('/coach-setup?fresh=true');
    }
  }
}

class _ConfirmStartNewPlanDialog extends StatelessWidget {
  const _ConfirmStartNewPlanDialog();

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      backgroundColor: AppColors.glassFill,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      title: const Text(
        'Start a new plan?',
        style: TextStyle(color: AppColors.textOnGlass, fontWeight: FontWeight.bold),
      ),
      content: const Text(
        'Your current plan will be replaced once you apply the new one. '
        'Past plans stay on your record but stop being the active plan.',
        style: TextStyle(color: AppColors.textOnGlass, fontSize: 14),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(false),
          child: const Text('Cancel'),
        ),
        ElevatedButton(
          style: ElevatedButton.styleFrom(
            backgroundColor: AppColors.accent,
            foregroundColor: Colors.white,
          ),
          onPressed: () => Navigator.of(context).pop(true),
          child: const Text('Start new plan'),
        ),
      ],
    );
  }
}

// ── Empty / loading / error states ──────────────────────────────────────────

class _EmptyState extends StatelessWidget {
  const _EmptyState();

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
      children: [
        Text('Coach', style: AppText.screenTitle),
        const SizedBox(height: 16),
        GlassCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.accent.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: const Icon(Icons.restaurant_menu, color: AppColors.accent, size: 28),
              ),
              const SizedBox(height: 16),
              const Text(
                'Set up your nutrition plan',
                style: TextStyle(
                  color: AppColors.textOnGlass,
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'Answer a few questions about your goal, body, and training and the coach will calculate calorie + macro targets you can hit each day.',
                style: TextStyle(color: AppColors.textMutedOnGlass, fontSize: 14, height: 1.4),
              ),
              const SizedBox(height: 20),
              AccentButton(
                label: 'Start setup',
                icon: Icons.arrow_forward,
                fullWidth: true,
                onPressed: () => context.go('/coach-setup?fresh=true'),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _LoadingPage extends StatelessWidget {
  const _LoadingPage();
  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
      children: [
        Text('Coach', style: AppText.screenTitle),
        const SizedBox(height: 32),
        const Center(
          child: SizedBox(
            width: 24,
            height: 24,
            child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.accent),
          ),
        ),
      ],
    );
  }
}

class _ErrorPage extends StatelessWidget {
  const _ErrorPage();
  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
      children: [
        Text('Coach', style: AppText.screenTitle),
        const SizedBox(height: 16),
        GlassCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                "Couldn't load your coach plan.",
                style: AppText.value.copyWith(color: Colors.redAccent),
              ),
              const SizedBox(height: 8),
              Text(
                'Pull down to retry, or check your network.',
                style: AppText.caption,
              ),
            ],
          ),
        ),
      ],
    );
  }
}
