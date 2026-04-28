import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/repositories/athlete_repository.dart';
import '../../models/athlete_dashboard.dart';
import '../../theme/app_colors.dart';
import '../../theme/app_text.dart';
import '../glass_card.dart';
import '../section_header.dart';

/// Streak number + 5×7 day grid. Mirrors the web's ConsistencyCard.
class ConsistencyCard extends ConsumerWidget {
  const ConsistencyCard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(consistencySummaryProvider);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SectionHeader(
          title: 'Consistency',
          subtitle: 'Past 35 days',
        ),
        GlassCard(
          child: async.when(
            loading: () => const _Loading(),
            error: (_, _) => const _Error(),
            data: (summary) {
              if (summary == null) return const _Error();
              return _Body(summary: summary);
            },
          ),
        ),
      ],
    );
  }
}

class _Body extends StatelessWidget {
  final ConsistencySummary summary;
  const _Body({required this.summary});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.baseline,
          textBaseline: TextBaseline.alphabetic,
          children: [
            Text(
              '${summary.streak}',
              style: AppText.bigValue.copyWith(color: AppColors.accent),
            ),
            const SizedBox(width: 6),
            Text(
              summary.streak == 1 ? 'day streak' : 'day streak',
              style: AppText.label,
            ),
          ],
        ),
        const SizedBox(height: 14),
        _Grid(days: summary.days),
        const SizedBox(height: 12),
        Row(
          children: [
            _LegendDot(color: AppColors.proteinBlue, label: 'Logged'),
            const SizedBox(width: 14),
            _LegendDot(color: AppColors.fatGreen, label: 'PR'),
          ],
        ),
      ],
    );
  }
}

class _Grid extends StatelessWidget {
  final List<ConsistencyDay> days;
  const _Grid({required this.days});

  @override
  Widget build(BuildContext context) {
    // Pad to 35 cells if the response somehow returns fewer.
    final cells = days.length >= 35
        ? days.sublist(days.length - 35)
        : [
            ...List<ConsistencyDay>.generate(
              35 - days.length,
              (i) => ConsistencyDay(date: '$i', status: ConsistencyDayStatus.empty),
            ),
            ...days,
          ];

    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 7,
        mainAxisSpacing: 5,
        crossAxisSpacing: 5,
      ),
      itemCount: cells.length,
      itemBuilder: (context, i) {
        final day = cells[i];
        Color color;
        switch (day.status) {
          case ConsistencyDayStatus.pr:
            color = AppColors.fatGreen;
            break;
          case ConsistencyDayStatus.logged:
            color = AppColors.proteinBlue.withValues(alpha: 0.7);
            break;
          case ConsistencyDayStatus.empty:
            color = Colors.black.withValues(alpha: 0.05);
            break;
        }
        return Container(
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.circular(6),
          ),
        );
      },
    );
  }
}

class _LegendDot extends StatelessWidget {
  final Color color;
  final String label;
  const _LegendDot({required this.color, required this.label});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 10,
          height: 10,
          decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(3)),
        ),
        const SizedBox(width: 6),
        Text(label, style: AppText.caption),
      ],
    );
  }
}

class _Loading extends StatelessWidget {
  const _Loading();
  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.symmetric(vertical: 24),
      child: Center(
        child: SizedBox(
          width: 22,
          height: 22,
          child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.accent),
        ),
      ),
    );
  }
}

class _Error extends StatelessWidget {
  const _Error();
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 24),
      child: Center(
        child: Text(
          'Consistency data unavailable.',
          style: AppText.caption.copyWith(color: Colors.redAccent),
        ),
      ),
    );
  }
}
