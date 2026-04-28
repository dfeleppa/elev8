import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../components/elev8_background.dart';
import '../components/glass_card.dart';
import '../components/sidebar_shell.dart';
import '../models/member_track_assignment.dart';
import '../models/programming_track.dart';
import '../services/owner_api_service.dart';
import '../theme/app_colors.dart';
import '../theme/app_text.dart';

final _allTracksProvider = FutureProvider<List<ProgrammingTrack>>((ref) async {
  return OwnerApiService.fetchAllTracks();
});

final _trackAssignmentsProvider =
    FutureProvider<List<MemberTrackAssignment>>((ref) async {
  return OwnerApiService.fetchTrackMemberAssignments();
});

/// Combined "tracks + their assigned members" view that the owner page
/// renders side-by-side on web.
final _tracksWithMembershipsProvider =
    FutureProvider<_TracksAndMembers>((ref) async {
  final tracks = await ref.watch(_allTracksProvider.future);
  final assignments = await ref.watch(_trackAssignmentsProvider.future);
  return _TracksAndMembers(tracks: tracks, assignments: assignments);
});

class _TracksAndMembers {
  final List<ProgrammingTrack> tracks;
  final List<MemberTrackAssignment> assignments;
  const _TracksAndMembers({required this.tracks, required this.assignments});

  /// Members (any track count) per track id, looked up by track name
  /// (the source column is a comma-separated string of names).
  List<MemberTrackAssignment> membersFor(ProgrammingTrack track) {
    final needle = track.name.trim().toLowerCase();
    return assignments
        .where((a) => a.tracks.any((t) => t.toLowerCase() == needle))
        .toList();
  }
}

/// Owner-only Tracks & Memberships screen.
class OwnerTracksMembershipsScreen extends ConsumerStatefulWidget {
  const OwnerTracksMembershipsScreen({super.key});

  @override
  ConsumerState<OwnerTracksMembershipsScreen> createState() =>
      _OwnerTracksMembershipsScreenState();
}

class _OwnerTracksMembershipsScreenState
    extends ConsumerState<OwnerTracksMembershipsScreen> {
  String _query = '';

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(_tracksWithMembershipsProvider);
    return SidebarShell(
      child: Scaffold(
        backgroundColor: Colors.transparent,
        body: Elev8Background(
          child: SafeArea(
            child: RefreshIndicator(
              color: AppColors.accent,
              onRefresh: () async {
                ref.invalidate(_allTracksProvider);
                ref.invalidate(_trackAssignmentsProvider);
                await ref.read(_tracksWithMembershipsProvider.future);
              },
              child: async.when(
                loading: () => const _LoadingState(),
                error: (e, _) => _ErrorState(message: e.toString()),
                data: (data) => _Loaded(
                  data: data,
                  query: _query,
                  onQueryChanged: (q) => setState(() => _query = q),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// ── States ───────────────────────────────────────────────────────────────

class _LoadingState extends StatelessWidget {
  const _LoadingState();

  @override
  Widget build(BuildContext context) => ListView(
    physics: const AlwaysScrollableScrollPhysics(),
    children: const [
      SizedBox(height: 200),
      Center(child: CircularProgressIndicator(color: AppColors.accent)),
    ],
  );
}

class _ErrorState extends StatelessWidget {
  final String message;
  const _ErrorState({required this.message});

  @override
  Widget build(BuildContext context) {
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.all(20),
      children: [
        const SizedBox(height: 80),
        GlassCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Icon(Icons.error_outline, color: Colors.redAccent),
              const SizedBox(height: 8),
              Text("Couldn't load tracks", style: AppText.cardTitle),
              const SizedBox(height: 6),
              Text(message, style: AppText.label),
            ],
          ),
        ),
      ],
    );
  }
}

class _Loaded extends StatelessWidget {
  final _TracksAndMembers data;
  final String query;
  final ValueChanged<String> onQueryChanged;

  const _Loaded({
    required this.data,
    required this.query,
    required this.onQueryChanged,
  });

  @override
  Widget build(BuildContext context) {
    final filtered = _filter(data.tracks, query);
    final totalMembers = data.assignments
        .where((a) => a.tracks.isNotEmpty)
        .length;

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
      children: [
        Text('MANAGEMENT', style: AppText.eyebrow),
        const SizedBox(height: 4),
        Text('Tracks & Memberships', style: AppText.screenTitle),
        const SizedBox(height: 6),
        Text(
          '${data.tracks.length} ${data.tracks.length == 1 ? "track" : "tracks"} '
          '· $totalMembers ${totalMembers == 1 ? "member" : "members"} assigned',
          style: AppText.label,
        ),
        const SizedBox(height: 16),
        _SearchField(value: query, onChanged: onQueryChanged),
        const SizedBox(height: 16),
        if (filtered.isEmpty)
          _EmptyResults(hasQuery: query.isNotEmpty)
        else
          for (final track in filtered)
            _TrackCard(
              track: track,
              members: data.membersFor(track),
            ),
      ],
    );
  }

  static List<ProgrammingTrack> _filter(
    List<ProgrammingTrack> rows,
    String q,
  ) {
    if (q.trim().isEmpty) return rows;
    final needle = q.trim().toLowerCase();
    return rows.where((t) {
      return t.name.toLowerCase().contains(needle) ||
          (t.code ?? '').toLowerCase().contains(needle) ||
          (t.description ?? '').toLowerCase().contains(needle);
    }).toList();
  }
}

class _SearchField extends StatelessWidget {
  final String value;
  final ValueChanged<String> onChanged;
  const _SearchField({required this.value, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return TextField(
      onChanged: onChanged,
      decoration: InputDecoration(
        hintText: 'Search by track name, code, description',
        hintStyle: AppText.label,
        prefixIcon: const Icon(Icons.search, color: Colors.black45),
        filled: true,
        fillColor: AppColors.glassFill,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 16,
          vertical: 14,
        ),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide(color: AppColors.glassBorder),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide(color: AppColors.glassBorder),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: AppColors.accent, width: 1.5),
        ),
      ),
    );
  }
}

class _EmptyResults extends StatelessWidget {
  final bool hasQuery;
  const _EmptyResults({required this.hasQuery});

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      child: Column(
        children: [
          const Icon(
            Icons.layers_outlined,
            size: 36,
            color: AppColors.textMutedOnGlass,
          ),
          const SizedBox(height: 8),
          Text(
            hasQuery ? 'No matches' : 'No tracks yet',
            style: AppText.cardTitle,
          ),
          const SizedBox(height: 4),
          Text(
            hasQuery
                ? 'Try a different track name or code.'
                : 'Add your first track on the web app.',
            style: AppText.label,
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}

// ── Track card ───────────────────────────────────────────────────────────

class _TrackCard extends StatelessWidget {
  final ProgrammingTrack track;
  final List<MemberTrackAssignment> members;
  const _TrackCard({required this.track, required this.members});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: GlassCard(
        padding: const EdgeInsets.all(16),
        onTap: () => _showTrackSheet(context, track, members),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    track.name,
                    style: AppText.value,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                if (!track.isActive)
                  _Tag(label: 'INACTIVE', color: Colors.redAccent),
                if (!track.isActive) const SizedBox(width: 6),
                _Tag(
                  label: track.isPrivate ? 'PRIVATE' : 'PUBLIC',
                  color: track.isPrivate
                      ? Colors.deepPurple
                      : AppColors.accent,
                ),
              ],
            ),
            if ((track.description ?? '').isNotEmpty) ...[
              const SizedBox(height: 4),
              Text(
                track.description!,
                style: AppText.caption,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            ],
            const SizedBox(height: 10),
            Row(
              children: [
                _MetaPill(
                  icon: Icons.people_outline,
                  text:
                      '${members.length} ${members.length == 1 ? "member" : "members"}',
                ),
                const SizedBox(width: 6),
                _MetaPill(
                  icon: Icons.tune,
                  text:
                      '${track.numberOfLevels} ${track.numberOfLevels == 1 ? "level" : "levels"}',
                ),
                if (track.hideWorkoutsDaysPrior > 0) ...[
                  const SizedBox(width: 6),
                  _MetaPill(
                    icon: Icons.schedule,
                    text: 'Hide -${track.hideWorkoutsDaysPrior}d',
                  ),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _Tag extends StatelessWidget {
  final String label;
  final Color color;
  const _Tag({required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w600,
          color: color,
        ),
      ),
    );
  }
}

class _MetaPill extends StatelessWidget {
  final IconData icon;
  final String text;
  const _MetaPill({required this.icon, required this.text});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: AppColors.glassFill,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: AppColors.glassBorder),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 12, color: AppColors.textMutedOnGlass),
          const SizedBox(width: 4),
          Text(
            text,
            style: AppText.caption.copyWith(fontWeight: FontWeight.w600),
          ),
        ],
      ),
    );
  }
}

// ── Detail sheet ─────────────────────────────────────────────────────────

void _showTrackSheet(
  BuildContext context,
  ProgrammingTrack track,
  List<MemberTrackAssignment> members,
) {
  showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (_) => _TrackDetailSheet(track: track, members: members),
  );
}

class _TrackDetailSheet extends StatelessWidget {
  final ProgrammingTrack track;
  final List<MemberTrackAssignment> members;
  const _TrackDetailSheet({required this.track, required this.members});

  @override
  Widget build(BuildContext context) {
    final hideMin = track.hideWorkoutsMinute.toString().padLeft(2, '0');
    return DraggableScrollableSheet(
      initialChildSize: 0.7,
      minChildSize: 0.4,
      maxChildSize: 0.95,
      builder: (_, scrollController) => Container(
        decoration: const BoxDecoration(
          color: AppColors.glassFill,
          borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
        ),
        child: ListView(
          controller: scrollController,
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                margin: const EdgeInsets.only(bottom: 16),
                decoration: BoxDecoration(
                  color: AppColors.glassBorder,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            Text(track.name, style: AppText.cardTitle),
            if ((track.description ?? '').isNotEmpty) ...[
              const SizedBox(height: 6),
              Text(track.description!, style: AppText.caption),
            ],
            const SizedBox(height: 20),
            _Detail('Code', track.code),
            _Detail(
              'Visibility',
              track.isPrivate ? 'Private' : 'Public',
            ),
            _Detail('Active', track.isActive ? 'Yes' : 'No'),
            _Detail('Levels', track.numberOfLevels.toString()),
            _Detail(
              'Hide workouts',
              track.hideWorkoutsDaysPrior > 0
                  ? '${track.hideWorkoutsDaysPrior} day(s) '
                        'before · ${track.hideWorkoutsHour}:$hideMin'
                  : 'Never',
            ),
            const SizedBox(height: 16),
            Text(
              'MEMBERS (${members.length})',
              style: AppText.eyebrow,
            ),
            const SizedBox(height: 6),
            if (members.isEmpty)
              Text('No members assigned to this track.', style: AppText.label)
            else
              for (final m in members) _MemberRow(member: m),
            const SizedBox(height: 12),
            Text(
              'Track edits and member assignments are managed on the '
              'web app for now.',
              style: AppText.caption,
            ),
          ],
        ),
      ),
    );
  }
}

class _MemberRow extends StatelessWidget {
  final MemberTrackAssignment member;
  const _MemberRow({required this.member});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          Container(
            width: 28,
            height: 28,
            alignment: Alignment.center,
            decoration: const BoxDecoration(
              shape: BoxShape.circle,
              gradient: LinearGradient(
                colors: [AppColors.accent, AppColors.accentDeep],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
            ),
            child: Text(
              _initials(member.fullName),
              style: const TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.bold,
                fontSize: 11,
              ),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  member.fullName.isEmpty ? member.email : member.fullName,
                  style: AppText.value,
                  overflow: TextOverflow.ellipsis,
                ),
                if (member.fullName.isNotEmpty &&
                    member.email != member.fullName)
                  Text(
                    member.email,
                    style: AppText.caption,
                    overflow: TextOverflow.ellipsis,
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

String _initials(String name) {
  final parts = name.split(RegExp(r'\s+')).where((s) => s.isNotEmpty).toList();
  if (parts.isEmpty) return '?';
  if (parts.length == 1) return parts.first[0].toUpperCase();
  return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
}

class _Detail extends StatelessWidget {
  final String label;
  final String? value;
  const _Detail(this.label, this.value);

  @override
  Widget build(BuildContext context) {
    final shown = (value == null || value!.trim().isEmpty) ? '—' : value!;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(width: 110, child: Text(label, style: AppText.label)),
          Expanded(child: Text(shown, style: AppText.value)),
        ],
      ),
    );
  }
}
