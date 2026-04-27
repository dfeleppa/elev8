import 'package:flutter/material.dart';

import '../../theme/app_colors.dart';
import '../../theme/app_text.dart';
import '../glass_card.dart';

/// Top of the coach screen when a plan is active. Shows the goal, daily
/// calories, days on plan, and intensity preset on a sky→blue gradient.
///
/// Mirrors the web's `viewMode === "dashboard"` Plan Overview block in
/// src/app/coach/CoachSetupClient.tsx.
class PlanOverviewCard extends StatelessWidget {
  final String? goalType;
  final double? targetCalories;
  final double? proteinGrams;
  final DateTime? effectiveDate;
  final String? intensityPreset;

  const PlanOverviewCard({
    super.key,
    required this.goalType,
    required this.targetCalories,
    required this.proteinGrams,
    required this.effectiveDate,
    required this.intensityPreset,
  });

  String _goalLabel(String? raw) {
    switch (raw) {
      case 'lose_weight':
        return 'Lose Weight';
      case 'gain_weight':
        return 'Gain Weight';
      case 'maintain_weight':
        return 'Maintain';
      case 'performance_reverse_diet':
        return 'Performance';
      default:
        return raw ?? 'Plan';
    }
  }

  String _intensityLabel(String? raw) {
    switch (raw) {
      case 'gentle':
        return 'Gentle';
      case 'moderate':
        return 'Moderate';
      case 'aggressive':
        return 'Aggressive';
      default:
        return raw ?? '—';
    }
  }

  int? _daysOnPlan() {
    if (effectiveDate == null) return null;
    return DateTime.now().difference(effectiveDate!).inDays;
  }

  @override
  Widget build(BuildContext context) {
    final days = _daysOnPlan();
    return GradientCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            _goalLabel(goalType),
            style: const TextStyle(
              color: Colors.white70,
              fontSize: 13,
              fontWeight: FontWeight.w600,
              letterSpacing: 1.5,
            ),
          ),
          const SizedBox(height: 4),
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Text(
                targetCalories == null
                    ? '—'
                    : targetCalories!.toStringAsFixed(0),
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 40,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(width: 6),
              const Text(
                'kcal/day',
                style: TextStyle(color: Colors.white70, fontSize: 14),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: _MetricCell(
                  label: 'Protein',
                  value: proteinGrams == null
                      ? '—'
                      : '${proteinGrams!.toStringAsFixed(0)}g',
                ),
              ),
              Expanded(
                child: _MetricCell(
                  label: 'On plan',
                  value: days == null ? '—' : '$days days',
                ),
              ),
              Expanded(
                child: _MetricCell(
                  label: 'Intensity',
                  value: _intensityLabel(intensityPreset),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _MetricCell extends StatelessWidget {
  final String label;
  final String value;
  const _MetricCell({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            color: Colors.white70,
            fontSize: 11,
            fontWeight: FontWeight.w600,
            letterSpacing: 1.2,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          value,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 16,
            fontWeight: FontWeight.w700,
          ),
        ),
      ],
    );
  }
}

/// Light-glass variant used for the "Starting Stats" and "Current Progress"
/// blocks below the gradient overview. Provided here so the coach screen has
/// a single source of layout for its three cards.
class CoachStatsCard extends StatelessWidget {
  final String title;
  final List<CoachStat> stats;
  final Widget? trailing;
  const CoachStatsCard({
    super.key,
    required this.title,
    required this.stats,
    this.trailing,
  });

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  title,
                  style: AppText.eyebrow.copyWith(letterSpacing: 1.8),
                ),
              ),
              if (trailing != null) trailing!,
            ],
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 12,
            runSpacing: 12,
            children: stats.map((s) => _Stat(stat: s)).toList(),
          ),
        ],
      ),
    );
  }
}

class CoachStat {
  final String label;
  final String value;
  final Color? accentColor;
  const CoachStat({required this.label, required this.value, this.accentColor});
}

class _Stat extends StatelessWidget {
  final CoachStat stat;
  const _Stat({required this.stat});

  @override
  Widget build(BuildContext context) {
    final accent = stat.accentColor ?? AppColors.accent;
    return ConstrainedBox(
      constraints: const BoxConstraints(minWidth: 120),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: accent.withValues(alpha: 0.06),
          border: Border.all(color: accent.withValues(alpha: 0.18)),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(stat.label, style: AppText.caption),
            const SizedBox(height: 2),
            Text(stat.value, style: AppText.value),
          ],
        ),
      ),
    );
  }
}
