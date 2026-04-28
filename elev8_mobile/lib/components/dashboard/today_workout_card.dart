import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../theme/app_colors.dart';
import '../../theme/app_text.dart';
import '../../workout_repository.dart';
import '../glass_card.dart';
import '../section_header.dart';

/// "Today's Workout" — lists the programming blocks queued for today.
///
/// Reuses the existing [todaysProgrammingProvider] from
/// `workout_repository.dart` rather than introducing a parallel fetch.
class TodayWorkoutCard extends ConsumerWidget {
  const TodayWorkoutCard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(todaysProgrammingProvider);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SectionHeader(
          title: "Today's Workout",
          subtitle: 'Programming for today',
        ),
        GlassCard(
          child: async.when(
            loading: () => const _Loading(),
            error: (_, _) => const _Error(message: "Couldn't load today's programming."),
            data: (blocks) {
              if (blocks.isEmpty) {
                return const _Empty(message: 'No workout programmed for today.');
              }
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  for (final b in blocks) _BlockRow(block: b),
                ],
              );
            },
          ),
        ),
      ],
    );
  }
}

class _BlockRow extends StatelessWidget {
  final Map<String, dynamic> block;
  const _BlockRow({required this.block});

  String _typeLabel(String? raw) {
    switch (raw) {
      case 'warmup':
        return 'Warmup';
      case 'lift':
        return 'Lift';
      case 'workout':
        return 'WOD';
      case 'cooldown':
        return 'Cooldown';
      default:
        return (raw ?? '').toUpperCase();
    }
  }

  @override
  Widget build(BuildContext context) {
    final title = (block['title'] as String?)?.trim();
    final type = block['block_type'] as String?;
    final description = (block['description'] as String?)?.trim();

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            margin: const EdgeInsets.only(top: 4, right: 12),
            width: 8,
            height: 8,
            decoration: const BoxDecoration(
              color: AppColors.accent,
              shape: BoxShape.circle,
            ),
          ),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title?.isNotEmpty == true ? title! : _typeLabel(type),
                  style: AppText.value,
                ),
                if (description != null && description.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(
                    description,
                    style: AppText.caption,
                    maxLines: 3,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ],
            ),
          ),
          if (type != null)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: AppColors.accent.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(
                _typeLabel(type),
                style: AppText.caption.copyWith(
                  color: AppColors.accent,
                  fontWeight: FontWeight.w600,
                ),
              ),
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
  final String message;
  const _Empty({required this.message});
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 24),
      child: Center(child: Text(message, style: AppText.caption)),
    );
  }
}

class _Error extends StatelessWidget {
  final String message;
  const _Error({required this.message});
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 24),
      child: Center(
        child: Text(
          message,
          style: AppText.caption.copyWith(color: Colors.redAccent),
        ),
      ),
    );
  }
}
