import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../components/elev8_background.dart';
import '../components/glass_card.dart';
import '../components/sidebar_shell.dart';
import '../models/owner_staff.dart';
import '../services/owner_api_service.dart';
import '../theme/app_colors.dart';
import '../theme/app_text.dart';

final ownerStaffProvider = FutureProvider<List<OwnerStaff>>((ref) async {
  return OwnerApiService.fetchStaff();
});

/// Owner-only Staff roster.
///
/// Read-only first cut — mirrors what the web /owner/staff page lists
/// (every app_user with role coach/admin/owner) and surfaces each
/// member's role + pay rates in a tap-to-open detail sheet.
class OwnerStaffScreen extends ConsumerStatefulWidget {
  const OwnerStaffScreen({super.key});

  @override
  ConsumerState<OwnerStaffScreen> createState() => _OwnerStaffScreenState();
}

class _OwnerStaffScreenState extends ConsumerState<OwnerStaffScreen> {
  String _query = '';

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(ownerStaffProvider);
    return SidebarShell(
      child: Scaffold(
        backgroundColor: Colors.transparent,
        body: Elev8Background(
          child: SafeArea(
            child: RefreshIndicator(
              color: AppColors.accent,
              onRefresh: () async {
                ref.invalidate(ownerStaffProvider);
                await ref.read(ownerStaffProvider.future);
              },
              child: async.when(
                loading: () => const _LoadingState(),
                error: (e, _) => _ErrorState(message: e.toString()),
                data: (staff) => _Loaded(
                  staff: staff,
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
        Center(child: CircularProgressIndicator(color: AppColors.accent)),
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
              Text("Couldn't load staff", style: AppText.cardTitle),
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
  final List<OwnerStaff> staff;
  final String query;
  final ValueChanged<String> onQueryChanged;

  const _Loaded({
    required this.staff,
    required this.query,
    required this.onQueryChanged,
  });

  @override
  Widget build(BuildContext context) {
    final filtered = _filter(staff, query);
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
      children: [
        Text('MANAGEMENT', style: AppText.eyebrow),
        const SizedBox(height: 4),
        Text('Staff', style: AppText.screenTitle),
        const SizedBox(height: 6),
        Text(
          '${staff.length} ${staff.length == 1 ? "person" : "people"} '
          'on payroll',
          style: AppText.label,
        ),
        const SizedBox(height: 16),
        _SearchField(value: query, onChanged: onQueryChanged),
        const SizedBox(height: 16),
        if (filtered.isEmpty)
          _EmptyResults(hasQuery: query.isNotEmpty)
        else
          ...filtered.map((s) => _StaffCard(staff: s)),
      ],
    );
  }

  static List<OwnerStaff> _filter(List<OwnerStaff> rows, String q) {
    if (q.trim().isEmpty) return rows;
    final needle = q.trim().toLowerCase();
    return rows.where((s) {
      return s.displayName.toLowerCase().contains(needle) ||
          (s.email ?? '').toLowerCase().contains(needle) ||
          (s.role ?? '').toLowerCase().contains(needle);
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
        hintText: 'Search by name, email, role',
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
            Icons.groups_outlined,
            size: 36,
            color: AppColors.textMutedOnGlass,
          ),
          const SizedBox(height: 8),
          Text(
            hasQuery ? 'No matches' : 'No staff yet',
            style: AppText.cardTitle,
          ),
          const SizedBox(height: 4),
          Text(
            hasQuery
                ? 'Try a different name, email, or role.'
                : 'Promote a member to coach or admin to get started.',
            style: AppText.label,
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}

// ── Staff card ───────────────────────────────────────────────────────────

class _StaffCard extends StatelessWidget {
  final OwnerStaff staff;
  const _StaffCard({required this.staff});

  @override
  Widget build(BuildContext context) {
    final pay = _payrateBadge(staff);
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: GlassCard(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        onTap: () => _showStaffSheet(context, staff),
        child: Row(
          children: [
            _Avatar(initials: staff.initials),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    staff.displayName,
                    style: AppText.value,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 2),
                  Text(
                    staff.email ?? '—',
                    style: AppText.caption,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 6,
                    runSpacing: 6,
                    children: [
                      if ((staff.role ?? '').isNotEmpty)
                        _Tag(
                          label: staff.role!.toUpperCase(),
                          color: _roleColor(staff.role),
                        ),
                      if (pay != null) _Tag(label: pay, color: AppColors.accent),
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

  String? _payrateBadge(OwnerStaff s) {
    final fmt = NumberFormat.simpleCurrency();
    final pieces = <String>[];
    if (s.coachingPayrate != null) {
      pieces.add('${fmt.format(s.coachingPayrate)} coaching');
    }
    if (s.officePayrate != null) {
      pieces.add('${fmt.format(s.officePayrate)} office');
    }
    return pieces.isEmpty ? null : pieces.join(' • ');
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
      decoration: const BoxDecoration(
        shape: BoxShape.circle,
        gradient: LinearGradient(
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

Color _roleColor(String? role) {
  switch ((role ?? '').toLowerCase()) {
    case 'owner':
      return Colors.deepPurple;
    case 'admin':
      return Colors.indigo;
    case 'coach':
      return AppColors.accent;
    default:
      return AppColors.textMutedOnGlass;
  }
}

// ── Detail sheet ─────────────────────────────────────────────────────────

void _showStaffSheet(BuildContext context, OwnerStaff s) {
  showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (_) => _StaffDetailSheet(staff: s),
  );
}

class _StaffDetailSheet extends StatelessWidget {
  final OwnerStaff staff;
  const _StaffDetailSheet({required this.staff});

  @override
  Widget build(BuildContext context) {
    final fmt = NumberFormat.simpleCurrency();
    return DraggableScrollableSheet(
      initialChildSize: 0.55,
      minChildSize: 0.35,
      maxChildSize: 0.9,
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
                _Avatar(initials: staff.initials),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(staff.displayName, style: AppText.cardTitle),
                      if ((staff.email ?? '').isNotEmpty)
                        Text(staff.email!, style: AppText.caption),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),
            _Detail('Role', staff.role?.toUpperCase()),
            _Detail(
              'Coaching pay',
              staff.coachingPayrate == null
                  ? null
                  : '${fmt.format(staff.coachingPayrate)}/hr',
            ),
            _Detail(
              'Office pay',
              staff.officePayrate == null
                  ? null
                  : '${fmt.format(staff.officePayrate)}/hr',
            ),
            const SizedBox(height: 12),
            Text(
              'Payroll edits and role changes are managed on the web '
              'app for now.',
              style: AppText.caption,
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
          SizedBox(width: 110, child: Text(label, style: AppText.label)),
          Expanded(child: Text(shown, style: AppText.value)),
        ],
      ),
    );
  }
}
