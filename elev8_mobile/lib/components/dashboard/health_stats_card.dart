import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/repositories/athlete_repository.dart';
import '../../models/athlete_dashboard.dart';
import '../../theme/app_colors.dart';
import '../../theme/app_text.dart';
import '../glass_card.dart';
import '../section_header.dart';

/// Body composition + top lift PRs.
class HealthStatsCard extends ConsumerWidget {
  const HealthStatsCard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(healthStatsProvider);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SectionHeader(
          title: 'Health Stats',
          subtitle: 'Body comp + top lifts',
        ),
        GlassCard(
          child: async.when(
            loading: () => const _Loading(),
            error: (_, _) => const _Unavailable(),
            data: (stats) {
              if (stats == null || stats.isEmpty) return const _Empty();
              return _Body(stats: stats);
            },
          ),
        ),
      ],
    );
  }
}

class _Body extends StatelessWidget {
  final HealthStatsSnapshot stats;
  const _Body({required this.stats});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (stats.body.isNotEmpty) ...[
          Text('Body', style: AppText.eyebrow),
          const SizedBox(height: 8),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: stats.body.map((s) => _StatTile(stat: s)).toList(),
          ),
        ],
        if (stats.body.isNotEmpty && stats.lifts.isNotEmpty)
          const SizedBox(height: 18),
        if (stats.lifts.isNotEmpty) ...[
          Text('Top Lifts', style: AppText.eyebrow),
          const SizedBox(height: 8),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: stats.lifts.map((s) => _StatTile(stat: s)).toList(),
          ),
        ],
      ],
    );
  }
}

class _StatTile extends StatelessWidget {
  final HealthStat stat;
  const _StatTile({required this.stat});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: AppColors.accent.withValues(alpha: 0.06),
        border: Border.all(color: AppColors.accent.withValues(alpha: 0.18)),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(stat.label, style: AppText.caption),
          const SizedBox(height: 2),
          Text(
            '${stat.value?.toStringAsFixed(stat.value! % 1 == 0 ? 0 : 1) ?? '—'} ${stat.unit}',
            style: AppText.value,
          ),
        ],
      ),
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

class _Empty extends StatelessWidget {
  const _Empty();
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 16),
      child: Text(
        'Log a body weight or lift PR to see stats here.',
        style: AppText.caption,
      ),
    );
  }
}

class _Unavailable extends StatelessWidget {
  const _Unavailable();
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 16),
      child: Text(
        'Health stats unavailable.',
        style: AppText.caption.copyWith(color: Colors.redAccent),
      ),
    );
  }
}
