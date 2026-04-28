import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../components/elev8_background.dart';
import '../components/glass_card.dart';
import '../components/sidebar_shell.dart';
import '../models/owner_member.dart';
import '../services/owner_api_service.dart';
import '../theme/app_colors.dart';
import '../theme/app_text.dart';

final ownerMembersProvider = FutureProvider<List<OwnerMember>>((ref) async {
  return OwnerApiService.fetchMembers();
});

/// Owner-only Members directory.
///
/// Mirrors src/app/owner/members/page.tsx in spirit (list of every gym
/// member) but adapts the desktop table into a phone-first card list
/// with search + tap-to-open detail sheet.
class OwnerMembersScreen extends ConsumerStatefulWidget {
  const OwnerMembersScreen({super.key});

  @override
  ConsumerState<OwnerMembersScreen> createState() =>
      _OwnerMembersScreenState();
}

class _OwnerMembersScreenState extends ConsumerState<OwnerMembersScreen> {
  String _query = '';

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(ownerMembersProvider);

    return SidebarShell(
      child: Scaffold(
        backgroundColor: Colors.transparent,
        body: Elev8Background(
          child: SafeArea(
            child: RefreshIndicator(
              color: AppColors.accent,
              onRefresh: () async {
                ref.invalidate(ownerMembersProvider);
                await ref.read(ownerMembersProvider.future);
              },
              child: async.when(
                loading: () => const _LoadingState(),
                error: (e, _) => _ErrorState(message: e.toString()),
                data: (members) => _Loaded(
                  members: members,
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
  Widget build(BuildContext context) {
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      children: const [
        SizedBox(height: 200),
        Center(
          child: CircularProgressIndicator(color: AppColors.accent),
        ),
      ],
    );
  }
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
              Text("Couldn't load members", style: AppText.cardTitle),
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
  final List<OwnerMember> members;
  final String query;
  final ValueChanged<String> onQueryChanged;

  const _Loaded({
    required this.members,
    required this.query,
    required this.onQueryChanged,
  });

  @override
  Widget build(BuildContext context) {
    final filtered = _filter(members, query);
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
      children: [
        Text('MANAGEMENT', style: AppText.eyebrow),
        const SizedBox(height: 4),
        Text('Members', style: AppText.screenTitle),
        const SizedBox(height: 6),
        Text(
          '${members.length} ${members.length == 1 ? "member" : "members"} '
          'in your directory',
          style: AppText.label,
        ),
        const SizedBox(height: 16),
        _SearchField(value: query, onChanged: onQueryChanged),
        const SizedBox(height: 16),
        if (filtered.isEmpty)
          _EmptyResults(hasQuery: query.isNotEmpty)
        else
          ...filtered.map((m) => _MemberCard(member: m)),
      ],
    );
  }

  static List<OwnerMember> _filter(List<OwnerMember> rows, String q) {
    if (q.trim().isEmpty) return rows;
    final needle = q.trim().toLowerCase();
    return rows.where((m) {
      return m.displayName.toLowerCase().contains(needle) ||
          (m.email ?? '').toLowerCase().contains(needle) ||
          (m.membership ?? '').toLowerCase().contains(needle) ||
          (m.tracks ?? '').toLowerCase().contains(needle) ||
          (m.status ?? '').toLowerCase().contains(needle);
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
        hintText: 'Search by name, email, membership',
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
            Icons.people_outline,
            size: 36,
            color: AppColors.textMutedOnGlass,
          ),
          const SizedBox(height: 8),
          Text(
            hasQuery ? 'No matches' : 'No members yet',
            style: AppText.cardTitle,
          ),
          const SizedBox(height: 4),
          Text(
            hasQuery
                ? 'Try a different name or email.'
                : 'Members will appear here after they sign up or are imported.',
            style: AppText.label,
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}

// ── Member card ──────────────────────────────────────────────────────────

class _MemberCard extends StatelessWidget {
  final OwnerMember member;
  const _MemberCard({required this.member});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: GlassCard(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        onTap: () => _showMemberSheet(context, member),
        child: Row(
          children: [
            _Avatar(initials: member.initials),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    member.displayName,
                    style: AppText.value,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 2),
                  Text(
                    member.email ?? '—',
                    style: AppText.caption,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 6,
                    runSpacing: 6,
                    children: [
                      if ((member.membership ?? '').isNotEmpty)
                        _Tag(
                          label: member.membership!,
                          color: AppColors.accent,
                        ),
                      if ((member.status ?? '').isNotEmpty)
                        _Tag(
                          label: member.status!,
                          color: _statusColor(member.status),
                        ),
                    ],
                  ),
                ],
              ),
            ),
            const Icon(
              Icons.chevron_right,
              color: AppColors.textMutedOnGlass,
            ),
          ],
        ),
      ),
    );
  }
}

class _Avatar extends StatelessWidget {
  final String initials;
  const _Avatar({required this.initials});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 44,
      height: 44,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: const LinearGradient(
          colors: [AppColors.accent, AppColors.accentDeep],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: Text(
        initials,
        style: const TextStyle(
          color: Colors.white,
          fontWeight: FontWeight.bold,
          fontSize: 15,
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

Color _statusColor(String? status) {
  switch ((status ?? '').toLowerCase()) {
    case 'active':
      return Colors.green;
    case 'paused':
    case 'on_hold':
    case 'on hold':
      return Colors.orange;
    case 'cancelled':
    case 'canceled':
    case 'inactive':
      return Colors.redAccent;
    default:
      return AppColors.accent;
  }
}

// ── Detail sheet ─────────────────────────────────────────────────────────

void _showMemberSheet(BuildContext context, OwnerMember m) {
  showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (_) => _MemberDetailSheet(member: m),
  );
}

class _MemberDetailSheet extends StatelessWidget {
  final OwnerMember member;
  const _MemberDetailSheet({required this.member});

  @override
  Widget build(BuildContext context) {
    final dateFmt = DateFormat('MMM d, yyyy');
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
            Row(
              children: [
                _Avatar(initials: member.initials),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(member.displayName, style: AppText.cardTitle),
                      if ((member.email ?? '').isNotEmpty)
                        Text(member.email!, style: AppText.caption),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),
            _Detail('Membership', member.membership),
            _Detail('Status', member.status),
            _Detail('Role', member.role),
            _Detail('Tracks', member.tracks),
            _Detail(
              'MRR',
              member.mrr == null
                  ? null
                  : NumberFormat.simpleCurrency().format(member.mrr),
            ),
            _Detail(
              'Attendance',
              member.attendanceCount?.toString(),
            ),
            _Detail(
              'Last check-in',
              member.lastCheckIn == null
                  ? null
                  : dateFmt.format(member.lastCheckIn!),
            ),
            _Detail(
              'Last active',
              member.lastActive == null
                  ? null
                  : dateFmt.format(member.lastActive!),
            ),
            _Detail('Phone', member.phone),
            _Detail('Gender', member.gender),
            _Detail('Birth date', member.birthDate),
            _Detail('Address', member.address),
            _Detail('Tags', member.tags),
            if ((member.statusNotes ?? '').isNotEmpty) ...[
              const SizedBox(height: 12),
              Text('Status notes', style: AppText.eyebrow),
              const SizedBox(height: 4),
              Text(member.statusNotes!, style: AppText.label),
            ],
            const SizedBox(height: 16),
            _Detail(
              'Joined',
              member.createdAt == null
                  ? null
                  : dateFmt.format(member.createdAt!),
            ),
          ],
        ),
      ),
    );
  }
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
          SizedBox(
            width: 110,
            child: Text(label, style: AppText.label),
          ),
          Expanded(
            child: Text(shown, style: AppText.value),
          ),
        ],
      ),
    );
  }
}
