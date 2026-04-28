import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../components/elev8_background.dart';
import '../components/glass_card.dart';
import '../components/sidebar_shell.dart';
import '../models/owner_schedule_class.dart';
import '../services/owner_api_service.dart';
import '../theme/app_colors.dart';
import '../theme/app_text.dart';

final ownerScheduleProvider =
    FutureProvider<List<OwnerScheduleClass>>((ref) async {
  return OwnerApiService.fetchScheduleClasses();
});

const _daysOfWeek = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const _dayLong = {
  'Mo': 'Monday',
  'Tu': 'Tuesday',
  'We': 'Wednesday',
  'Th': 'Thursday',
  'Fr': 'Friday',
  'Sa': 'Saturday',
  'Su': 'Sunday',
};

/// Owner-only Class Setup screen.
///
/// Read-only first cut — lists every recurring class on
/// `schedule_classes`, with a day-of-week filter and per-card details
/// (color-coded by `calendar_color`).
class OwnerScheduleScreen extends ConsumerStatefulWidget {
  const OwnerScheduleScreen({super.key});

  @override
  ConsumerState<OwnerScheduleScreen> createState() =>
      _OwnerScheduleScreenState();
}

class _OwnerScheduleScreenState extends ConsumerState<OwnerScheduleScreen> {
  String _query = '';
  String? _dayFilter;

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(ownerScheduleProvider);
    return SidebarShell(
      child: Scaffold(
        backgroundColor: Colors.transparent,
        body: Elev8Background(
          child: SafeArea(
            child: RefreshIndicator(
              color: AppColors.accent,
              onRefresh: () async {
                ref.invalidate(ownerScheduleProvider);
                await ref.read(ownerScheduleProvider.future);
              },
              child: async.when(
                loading: () => const _LoadingState(),
                error: (e, _) => _ErrorState(message: e.toString()),
                data: (classes) => _Loaded(
                  classes: classes,
                  query: _query,
                  dayFilter: _dayFilter,
                  onQueryChanged: (q) => setState(() => _query = q),
                  onDayChanged: (d) => setState(() => _dayFilter = d),
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
              Text("Couldn't load classes", style: AppText.cardTitle),
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
  final List<OwnerScheduleClass> classes;
  final String query;
  final String? dayFilter;
  final ValueChanged<String> onQueryChanged;
  final ValueChanged<String?> onDayChanged;

  const _Loaded({
    required this.classes,
    required this.query,
    required this.dayFilter,
    required this.onQueryChanged,
    required this.onDayChanged,
  });

  @override
  Widget build(BuildContext context) {
    final filtered = _filter(classes, query, dayFilter)..sort(_byTime);
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
      children: [
        Text('MANAGEMENT', style: AppText.eyebrow),
        const SizedBox(height: 4),
        Text('Class Setup', style: AppText.screenTitle),
        const SizedBox(height: 6),
        Text(
          '${classes.length} ${classes.length == 1 ? "class" : "classes"} '
          'on the schedule',
          style: AppText.label,
        ),
        const SizedBox(height: 16),
        _SearchField(value: query, onChanged: onQueryChanged),
        const SizedBox(height: 12),
        _DayFilter(selected: dayFilter, onChanged: onDayChanged),
        const SizedBox(height: 16),
        if (filtered.isEmpty)
          _EmptyResults(
            hasFilter: query.isNotEmpty || dayFilter != null,
          )
        else
          ...filtered.map((c) => _ClassCard(scheduleClass: c)),
      ],
    );
  }

  static List<OwnerScheduleClass> _filter(
    List<OwnerScheduleClass> rows,
    String q,
    String? day,
  ) {
    final needle = q.trim().toLowerCase();
    return rows.where((c) {
      if (day != null && !c.classDays.contains(day)) return false;
      if (needle.isEmpty) return true;
      return c.name.toLowerCase().contains(needle) ||
          (c.track?.name ?? '').toLowerCase().contains(needle) ||
          (c.defaultCoach?.displayName ?? '').toLowerCase().contains(needle);
    }).toList();
  }

  static int _byTime(OwnerScheduleClass a, OwnerScheduleClass b) =>
      a.classTime.compareTo(b.classTime);
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
        hintText: 'Search by class name, track, coach',
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

class _DayFilter extends StatelessWidget {
  final String? selected;
  final ValueChanged<String?> onChanged;
  const _DayFilter({required this.selected, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 36,
      child: ListView(
        scrollDirection: Axis.horizontal,
        children: [
          _Chip(
            label: 'All',
            isSelected: selected == null,
            onTap: () => onChanged(null),
          ),
          for (final day in _daysOfWeek) ...[
            const SizedBox(width: 6),
            _Chip(
              label: day,
              isSelected: selected == day,
              onTap: () => onChanged(selected == day ? null : day),
            ),
          ],
        ],
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  final String label;
  final bool isSelected;
  final VoidCallback onTap;

  const _Chip({
    required this.label,
    required this.isSelected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: isSelected ? AppColors.accent : AppColors.glassFill,
      borderRadius: BorderRadius.circular(999),
      child: InkWell(
        borderRadius: BorderRadius.circular(999),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(999),
            border: Border.all(color: AppColors.glassBorder),
          ),
          child: Text(
            label,
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: isSelected ? Colors.white : AppColors.textOnGlass,
            ),
          ),
        ),
      ),
    );
  }
}

class _EmptyResults extends StatelessWidget {
  final bool hasFilter;
  const _EmptyResults({required this.hasFilter});

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      child: Column(
        children: [
          const Icon(
            Icons.calendar_month_outlined,
            size: 36,
            color: AppColors.textMutedOnGlass,
          ),
          const SizedBox(height: 8),
          Text(
            hasFilter ? 'No matches' : 'No classes yet',
            style: AppText.cardTitle,
          ),
          const SizedBox(height: 4),
          Text(
            hasFilter
                ? 'Try clearing the search or day filter.'
                : 'Add your first recurring class on the web app.',
            style: AppText.label,
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}

// ── Class card ───────────────────────────────────────────────────────────

class _ClassCard extends StatelessWidget {
  final OwnerScheduleClass scheduleClass;
  const _ClassCard({required this.scheduleClass});

  @override
  Widget build(BuildContext context) {
    final c = scheduleClass;
    final stripe = _hexToColor(c.calendarColor);
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: GlassCard(
        padding: EdgeInsets.zero,
        onTap: () => _showClassSheet(context, c),
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Container(
                width: 5,
                decoration: BoxDecoration(
                  color: stripe,
                  borderRadius: const BorderRadius.only(
                    topLeft: Radius.circular(24),
                    bottomLeft: Radius.circular(24),
                  ),
                ),
              ),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(14, 14, 14, 14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(c.name, style: AppText.value),
                      const SizedBox(height: 2),
                      Text(
                        '${_formatTime(c.classTime)} · ${c.durationMinutes} min',
                        style: AppText.caption,
                      ),
                      const SizedBox(height: 8),
                      _DayPills(days: c.classDays),
                      const SizedBox(height: 10),
                      Wrap(
                        spacing: 6,
                        runSpacing: 6,
                        children: [
                          if ((c.track?.name ?? '').isNotEmpty)
                            _Tag(
                              label: c.track!.name!,
                              color: stripe,
                            ),
                          if (c.defaultCoach != null)
                            _Tag(
                              label: c.defaultCoach!.displayName,
                              color: AppColors.accent,
                              icon: Icons.person_outline,
                            ),
                          if (c.sizeLimit > 0)
                            _Tag(
                              label: 'Cap ${c.sizeLimit}',
                              color: AppColors.textMutedOnGlass,
                              icon: Icons.event_seat_outlined,
                            ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
              const Padding(
                padding: EdgeInsets.symmetric(horizontal: 8),
                child: Icon(
                  Icons.chevron_right,
                  color: AppColors.textMutedOnGlass,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _DayPills extends StatelessWidget {
  final List<String> days;
  const _DayPills({required this.days});

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 4,
      children: [
        for (final d in _daysOfWeek)
          Container(
            width: 26,
            height: 26,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: days.contains(d)
                  ? AppColors.accent.withValues(alpha: 0.12)
                  : Colors.transparent,
              border: Border.all(
                color: days.contains(d)
                    ? AppColors.accent
                    : AppColors.glassBorder,
              ),
            ),
            child: Text(
              d,
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w600,
                color: days.contains(d)
                    ? AppColors.accent
                    : AppColors.textMutedOnGlass,
              ),
            ),
          ),
      ],
    );
  }
}

class _Tag extends StatelessWidget {
  final String label;
  final Color color;
  final IconData? icon;
  const _Tag({required this.label, required this.color, this.icon});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 12, color: color),
            const SizedBox(width: 4),
          ],
          Text(
            label,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: color,
            ),
          ),
        ],
      ),
    );
  }
}

// ── Detail sheet ─────────────────────────────────────────────────────────

void _showClassSheet(BuildContext context, OwnerScheduleClass c) {
  showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (_) => _ClassDetailSheet(scheduleClass: c),
  );
}

class _ClassDetailSheet extends StatelessWidget {
  final OwnerScheduleClass scheduleClass;
  const _ClassDetailSheet({required this.scheduleClass});

  @override
  Widget build(BuildContext context) {
    final c = scheduleClass;
    final stripe = _hexToColor(c.calendarColor);
    final daysFmt = c.classDays
        .map((d) => _dayLong[d] ?? d)
        .join(', ');

    return DraggableScrollableSheet(
      initialChildSize: 0.65,
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
                Container(
                  width: 12,
                  height: 12,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: stripe,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(c.name, style: AppText.cardTitle),
                ),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              '${_formatTime(c.classTime)} · ${c.durationMinutes} min',
              style: AppText.caption,
            ),
            const SizedBox(height: 20),
            _Detail('Days', daysFmt.isEmpty ? null : daysFmt),
            _Detail('Track', c.track?.name),
            _Detail('Default coach', c.defaultCoach?.displayName),
            _Detail(
              'Capacity',
              c.sizeLimit > 0 ? '${c.sizeLimit} reservations' : null,
            ),
            _Detail(
              'Cutoff',
              c.reservationCutoffHours > 0
                  ? '${c.reservationCutoffHours} hours before class'
                  : null,
            ),
            _Detail('Starts', _prettyDate(c.startDate)),
            _Detail(
              'Ends',
              c.endDate == null ? 'Ongoing' : _prettyDate(c.endDate),
            ),
            _Detail('Color', c.calendarColor.toUpperCase()),
            const SizedBox(height: 12),
            Text(
              'Class edits are managed on the web app for now.',
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

// ── Helpers ──────────────────────────────────────────────────────────────

Color _hexToColor(String hex) {
  var v = hex.trim();
  if (v.startsWith('#')) v = v.substring(1);
  if (v.length == 6) v = 'FF$v';
  return Color(int.tryParse(v, radix: 16) ?? 0xFF3B82F6);
}

String _formatTime(String hhmm) {
  // hhmm is "HH:MM" 24-hour. Render in the user's locale.
  final parts = hhmm.split(':');
  if (parts.length != 2) return hhmm;
  final h = int.tryParse(parts[0]);
  final m = int.tryParse(parts[1]);
  if (h == null || m == null) return hhmm;
  final dt = DateTime(2000, 1, 1, h, m);
  return DateFormat.jm().format(dt);
}

String? _prettyDate(String? iso) {
  if (iso == null || iso.isEmpty) return null;
  final dt = DateTime.tryParse(iso);
  if (dt == null) return iso;
  return DateFormat('MMM d, yyyy').format(dt);
}
