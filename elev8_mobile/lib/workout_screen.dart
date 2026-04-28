import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import 'components/bottom_nav_bar.dart';
import 'components/elev8_background.dart';
import 'components/glass_card.dart';
import 'components/sidebar_shell.dart';
import 'data/repositories/athlete_repository.dart';
import 'models/programming_track.dart';
import 'theme/app_colors.dart';
import 'theme/app_text.dart';

/// Workout tab — today's programming for a selected track.
///
/// Replaces the previous "Home" tab. Tracks come from
/// /api/programming/tracks (bearer-authed); the day's blocks come from
/// /api/programming/week filtered to today's date.
class WorkoutScreen extends ConsumerWidget {
  const WorkoutScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tracksAsync = ref.watch(programmingTracksProvider);
    // effectiveTrackIdProvider handles the "user hasn't picked yet" fallback
    // to the first track, so the selector and the workout fetch agree on
    // which track is current.
    final selectedTrackId = ref.watch(effectiveTrackIdProvider);
    final workoutAsync = ref.watch(todaysWorkoutProvider);

    return SidebarShell(
      child: Scaffold(
        backgroundColor: Colors.transparent,
        body: Elev8Background(
          child: SafeArea(
            child: RefreshIndicator(
              color: AppColors.accent,
              onRefresh: () async {
                ref.invalidate(programmingTracksProvider);
                ref.invalidate(todaysWorkoutProvider);
                await Future.wait([
                  ref.read(programmingTracksProvider.future),
                  ref.read(todaysWorkoutProvider.future),
                ]);
              },
              child: ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
                children: [
                  _Header(),
                  const SizedBox(height: 20),
                  _TrackSelector(
                    tracksAsync: tracksAsync,
                    selectedTrackId: selectedTrackId,
                  ),
                  const SizedBox(height: 16),
                  _WorkoutBody(workoutAsync: workoutAsync),
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

class _Header extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final dateLabel = DateFormat('EEEE, MMMM d').format(DateTime.now());
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(dateLabel, style: AppText.label),
        const SizedBox(height: 2),
        Text("Today's Workout", style: AppText.screenTitle),
      ],
    );
  }
}

class _TrackSelector extends ConsumerWidget {
  final AsyncValue<List<ProgrammingTrack>> tracksAsync;
  final String? selectedTrackId;

  const _TrackSelector({required this.tracksAsync, required this.selectedTrackId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return tracksAsync.when(
      loading: () => const _SelectorSkeleton(),
      error: (_, _) => const _SelectorError(),
      data: (tracks) {
        if (tracks.isEmpty) {
          return GlassCard(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            child: Text(
              "Your gym hasn't added any programming tracks yet.",
              style: AppText.caption,
            ),
          );
        }
        final selected = tracks.firstWhere(
          (t) => t.id == selectedTrackId,
          orElse: () => tracks.first,
        );
        return GlassCard(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
          onTap: tracks.length == 1 ? null : () => _showPicker(context, ref, tracks, selected),
          child: Row(
            children: [
              const Icon(Icons.fitness_center, color: AppColors.accent, size: 20),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text('TRACK', style: AppText.eyebrow),
                    const SizedBox(height: 2),
                    Text(selected.name, style: AppText.value),
                  ],
                ),
              ),
              if (tracks.length > 1)
                const Icon(Icons.expand_more, color: AppColors.textMutedOnGlass),
            ],
          ),
        );
      },
    );
  }

  Future<void> _showPicker(
    BuildContext context,
    WidgetRef ref,
    List<ProgrammingTrack> tracks,
    ProgrammingTrack current,
  ) async {
    await showModalBottomSheet<void>(
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
              padding: const EdgeInsets.symmetric(vertical: 16),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Padding(
                    padding: const EdgeInsets.fromLTRB(20, 0, 20, 12),
                    child: Text('Choose track', style: AppText.cardTitle),
                  ),
                  for (final t in tracks)
                    InkWell(
                      onTap: () {
                        ref.read(selectedTrackProvider.notifier).set(t.id);
                        ref.invalidate(todaysWorkoutProvider);
                        Navigator.of(ctx).pop();
                      },
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
                        child: Row(
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(t.name, style: AppText.value),
                                  if (t.description != null && t.description!.isNotEmpty) ...[
                                    const SizedBox(height: 2),
                                    Text(
                                      t.description!,
                                      style: AppText.caption,
                                      maxLines: 2,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ],
                                ],
                              ),
                            ),
                            if (t.id == current.id)
                              const Icon(Icons.check, color: AppColors.accent),
                          ],
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}

class _SelectorSkeleton extends StatelessWidget {
  const _SelectorSkeleton();
  @override
  Widget build(BuildContext context) {
    return GlassCard(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 18),
      child: Row(
        children: [
          const SizedBox(
            width: 18,
            height: 18,
            child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.accent),
          ),
          const SizedBox(width: 12),
          Text('Loading tracks…', style: AppText.caption),
        ],
      ),
    );
  }
}

class _SelectorError extends StatelessWidget {
  const _SelectorError();
  @override
  Widget build(BuildContext context) {
    return GlassCard(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      child: Text(
        "Couldn't load tracks. Pull to retry.",
        style: AppText.caption.copyWith(color: Colors.redAccent),
      ),
    );
  }
}

class _WorkoutBody extends StatelessWidget {
  final AsyncValue<dynamic> workoutAsync;
  const _WorkoutBody({required this.workoutAsync});

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
    return workoutAsync.when(
      loading: () => const _BodyLoading(),
      error: (_, _) => const _BodyError(),
      data: (day) {
        if (day == null) {
          return GlassCard(
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 12),
              child: Text(
                'No workout programmed for today on this track.',
                style: AppText.caption,
              ),
            ),
          );
        }
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (day.title != null && day.title!.toString().isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(bottom: 12, left: 4),
                child: Text(day.title.toString(), style: AppText.cardTitle),
              ),
            for (final block in day.blocks) ...[
              GlassCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: AppColors.accent.withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Text(
                            _typeLabel(block.blockType),
                            style: AppText.caption.copyWith(
                              color: AppColors.accent,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                        if (block.title != null && block.title!.isNotEmpty)
                          Expanded(
                            child: Text(block.title!, style: AppText.value),
                          ),
                      ],
                    ),
                    if (block.description != null && block.description!.isNotEmpty) ...[
                      const SizedBox(height: 10),
                      Text(
                        block.description!,
                        style: AppText.label.copyWith(height: 1.4),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: 12),
            ],
          ],
        );
      },
    );
  }
}

class _BodyLoading extends StatelessWidget {
  const _BodyLoading();
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

class _BodyError extends StatelessWidget {
  const _BodyError();
  @override
  Widget build(BuildContext context) {
    return GlassCard(
      child: Text(
        "Couldn't load today's workout. Pull to retry.",
        style: AppText.caption.copyWith(color: Colors.redAccent),
      ),
    );
  }
}
